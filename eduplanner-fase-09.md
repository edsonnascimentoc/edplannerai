# Implementação da Fase 09: Painel Analítico e Dashboards de Desempenho (UC08) - EduPlanner

## 1. Visão Geral da Fase 09
A Fase 09 encerra a implementação do ciclo de software do **EduPlanner** com a entrega do **`UC08` (Visualizar Painel Analítico de Desempenho)**. Esta fase consolida e agrega os dados do banco relacional (PostgreSQL) e das séries temporais (TimescaleDB), gerando visualizações analíticas em tempo real sobre a proficiência por habilidade da BNCC, curvas de evolução do Kumon e indicadores gerais de turma para apoio à tomada de decisão pedagógica.

---

## 2. Consultas Analíticas Agregadas (PostgreSQL + TimescaleDB)

### A. Teia de Competências BNCC (Proficiência por Componente Curricular)
Agrupa o índice de proficiência validada por área e componente da BNCC para um estudante ou turma.

```sql
SELECT 
    h.nm_componente_curricular,
    COUNT(DISTINCT h.cd_codigo_bncc) AS total_habilidades_avaliadas,
    COUNT(DISTINCT CASE WHEN r.fl_proficiente = TRUE THEN h.cd_codigo_bncc END) AS habilidades_proficientes,
    ROUND(
        (COUNT(DISTINCT CASE WHEN r.fl_proficiente = TRUE THEN h.cd_codigo_bncc END)::DECIMAL / 
         NULLIF(COUNT(DISTINCT h.cd_codigo_bncc), 0)) * 100, 2
    ) AS taxa_proficiencia_percentual
FROM tb_registro_proficiencia r
JOIN tb_habilidade_bncc h ON r.cd_codigo_bncc = h.cd_codigo_bncc
WHERE r.id_estudante = :estudanteId
GROUP BY h.nm_componente_curricular;
```

### B. Evolução Temporal de Aprendizagem (TimescaleDB Time Buckets)
Consolida a curva média de desempenho quinzenal ou mensal do estudante.

```sql
SELECT 
    time_bucket('15 days', dt_registro) AS intervalo_quinzenal,
    ROUND(AVG(vl_nota_percentual), 2) AS media_nota_percentual,
    MAX(nr_consecutivos_acima_limiar) AS max_consecutivos
FROM tb_registro_proficiencia
WHERE id_estudante = :estudanteId
  AND dt_registro >= NOW() - INTERVAL '6 months'
GROUP BY intervalo_quinzenal
ORDER BY intervalo_quinzenal ASC;
```

---

## 3. Caso de Uso da Aplicação e Estratégia de Caching

### Caso de Uso: `ObterDashboardAnaliticoUseCase`
Orquestra as consultas agregadas aplicando cache em memória (Redis) com TTL de 5 minutos para otimizar acessos concorrentes de coordenadores.

```typescript
import { RedisClient } from '../../infrastructure/cache/RedisClient';
import { AnalyticsRepository } from '../../infrastructure/persistence/AnalyticsRepository';
import { DashboardDTO } from '../dtos/DashboardDTO';

export class ObterDashboardAnaliticoUseCase {
  constructor(
    private analyticsRepo: AnalyticsRepository,
    private cacheClient: RedisClient
  ) {}

  async execute(turmaId: string, periodoEmMeses: number = 6): Promise<DashboardDTO> {
    const cacheKey = `dashboard:turma:${turmaId}:periodo:${periodoEmMeses}`;
    
    // Check Cache
    const cachedData = await this.cacheClient.get<DashboardDTO>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Database Aggregation
    const teiaCompetencias = await this.analyticsRepo.obterTeiaCompetenciasTurma(turmaId);
    const evolucaoTemporal = await this.analyticsRepo.obterEvolucaoTemporalTurma(turmaId, periodoEmMeses);
    const distribuicaoProficiencia = await this.analyticsRepo.obterDistribuicaoProficienciaTurma(turmaId);

    const dashboard: DashboardDTO = {
      turmaId,
      teiaCompetencias,
      evolucaoTemporal,
      distribuicaoProficiencia,
      geradoEm: new Date().toISOString()
    };

    // Save Cache (TTL: 300 segundos)
    await this.cacheClient.set(cacheKey, dashboard, 300);

    return dashboard;
  }
}
```

---

## 4. Controlador REST / API Endpoints

```typescript
import { Request, Response } from 'express';
import { ObterDashboardAnaliticoUseCase } from '../../application/usecases/ObterDashboardAnaliticoUseCase';

export class AnalyticsController {
  constructor(private dashboardUseCase: ObterDashboardAnaliticoUseCase) {}

  async obterDashboardTurma(req: Request, res: Response): Promise<Response> {
    try {
      const { turmaId } = req.params;
      const periodo = req.query.periodo ? parseInt(req.query.periodo as string) : 6;

      const dashboard = await this.dashboardUseCase.execute(turmaId, periodo);

      return res.status(200).json(dashboard);
    } catch (error: any) {
      return res.status(500).json({
        type: 'errors/internal-server-error',
        title: 'Erro ao gerar painel analítico',
        status: 500,
        detail: error.message,
        code: 'ERR_ANALYTICS_FAILURE'
      });
    }
  }
}
```

---

## 5. Suite de Testes Automatizados da Fase 09

```typescript
import { ObterDashboardAnaliticoUseCase } from '../../../application/usecases/ObterDashboardAnaliticoUseCase';

describe('Fase 09 - Testes do Painel Analítico (UC08)', () => {
  let useCase: ObterDashboardAnaliticoUseCase;
  let mockRepo: any;
  let mockCache: any;

  beforeEach(() => {
    mockRepo = {
      obterTeiaCompetenciasTurma: jest.fn().mockResolvedValue([
        { componente: 'Matemática', taxaProficienciaPercentual: 85.5 }
      ]),
      obterEvolucaoTemporalTurma: jest.fn().mockResolvedValue([]),
      obterDistribuicaoProficienciaTurma: jest.fn().mockResolvedValue({ proficientes: 20, emConsolidacao: 5 })
    };

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true)
    };

    useCase = new ObterDashboardAnaliticoUseCase(mockRepo, mockCache);
  });

  it('Deve calcular e retornar as métricas agregadas do dashboard com sucesso', async () => {
    const result = await useCase.execute('turma-uuid-123');

    expect(result).toHaveProperty('teiaCompetencias');
    expect(result.teiaCompetencias[0].componente).toBe('Matemática');
    expect(mockCache.set).toHaveBeenCalledTimes(1);
  });
});
```