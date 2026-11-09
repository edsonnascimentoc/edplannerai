# Implementação da Fase 08: Acompanhamento Periódico Kumon & TimescaleDB (`UC07` - `/avaliar_progresso`) - EduPlanner

## 1. Visão Geral da Fase 08
A Fase 08 implementa o mecanismo de testes curtos e periódicos de fixação no estilo Kumon (`UC07`), disparados pelo comando `/avaliar_progresso`. Esta fase utiliza o banco de dados de séries temporais **TimescaleDB** (`tb_registro_proficiencia`) para suportar alto volume de registros de testes de progresso ao longo do tempo. A aplicação aplica rigorosamente as regras **`RN01`** (Vínculo BNCC) e **`RN03`** (Concessão de proficiência apenas após 2 avaliações periódicas consecutivas com desempenho \(\ge 85\%\)).

---

## 2. Agregado de Domínio (`RegistroProficiencia`)

### Entidade de Domínio:
```typescript
export class RegistroProficiencia {
  constructor(
    public readonly idEstudante: string,
    public readonly codigoHabilidadeBNCC: string,
    public notaPercentual: number,
    public historicoConsecutivo: number = 0,
    public ehProficiente: boolean = false,
    public readonly dataRegistro: Date = new Date()
  ) {
    this.validarInvariantes();
  }

  private validarInvariantes(): void {
    if (!this.codigoHabilidadeBNCC || this.codigoHabilidadeBNCC.trim() === '') {
      throw new Error('RN01_VIOLATION: O código da habilidade BNCC é obrigatório.');
    }
    if (this.notaPercentual < 0 || this.notaPercentual > 100) {
      throw new Error('INVALID_SCORE: A nota percentual deve estar entre 0 e 100.');
    }
  }

  public avaliarProgressoKumon(novaNota: number): void {
    this.notaPercentual = novaNota;
    
    if (novaNota >= 85) {
      this.historicoConsecutivo += 1;
      if (this.historicoConsecutivo >= 2) {
        this.ehProficiente = true;
      }
    } else {
      this.historicoConsecutivo = 0;
      this.ehProficiente = false;
    }
  }
}
```

---

## 3. Caso de Uso de Aplicação (`ProcessarAvaliacaoKumonUseCase`)

```typescript
export interface ProcessarAvaliacaoKumonDTO {
  estudanteId: string;
  codigoHabilidadeBNCC: string;
  notaPercentual: number;
}

export interface ResultadoKumonOutputDTO {
  estudanteId: string;
  codigoHabilidadeBNCC: string;
  notaPercentual: number;
  consecutivosAcimaLimiar: number;
  ehProficiente: boolean;
  sugerirAdaptacaoConteudo: boolean;
}

export class ProcessarAvaliacaoKumonUseCase {
  constructor(
    private readonly proficienciaRepository: IProficienciaRepository,
    private readonly bnccRepository: IBNCCRepository
  ) {}

  async execute(dto: ProcessarAvaliacaoKumonDTO): Promise<ResultadoKumonOutputDTO> {
    const habilidade = await this.bnccRepository.findByCodigo(dto.codigoHabilidadeBNCC);
    if (!habilidade) {
      throw new Error('ERR_BNCC_NAO_ENCONTRADA');
    }

    const ultimoRegistro = await this.proficienciaRepository.obterUltimoRegistro(
      dto.estudanteId,
      dto.codigoHabilidadeBNCC
    );

    const historicoAtual = ultimoRegistro ? ultimoRegistro.historicoConsecutivo : 0;
    const registro = new RegistroProficiencia(
      dto.estudanteId,
      dto.codigoHabilidadeBNCC,
      dto.notaPercentual,
      historicoAtual
    );

    registro.avaliarProgressoKumon(dto.notaPercentual);

    await this.proficienciaRepository.salvarSerieTemporal(registro);

    const sugerirAdaptacao = dto.notaPercentual < 85;

    return {
      estudanteId: registro.idEstudante,
      codigoHabilidadeBNCC: registro.codigoHabilidadeBNCC,
      notaPercentual: registro.notaPercentual,
      consecutivosAcimaLimiar: registro.historicoConsecutivo,
      ehProficiente: registro.ehProficiente,
      sugerirAdaptacaoConteudo: sugerirAdaptacao
    };
  }
}
```

---

## 4. Controlador REST (`/api/v1/avaliacoes/progresso`)

```typescript
import { Request, Response } from 'express';

export class ProgressoKumonController {
  constructor(private readonly processarAvaliacaoKumonUseCase: ProcessarAvaliacaoKumonUseCase) {}

  async handle(req: Request, res: Response): Promise<Response> {
    try {
      const { estudanteId, codigoHabilidadeBNCC, notaPercentual } = req.body;

      const resultado = await this.processarAvaliacaoKumonUseCase.execute({
        estudanteId,
        codigoHabilidadeBNCC,
        notaPercentual
      });

      return res.status(200).json(resultado);
    } catch (error: any) {
      if (error.message === 'ERR_BNCC_NAO_ENCONTRADA') {
        return res.status(404).json({
          type: 'errors/not-found',
          title: 'Habilidade BNCC Não Encontrada',
          status: 404,
          detail: 'O código BNCC informado não está catalogado.',
          code: 'ERR_BNCC_NAO_ENCONTRADA'
        });
      }

      return res.status(500).json({
        type: 'errors/internal-server-error',
        title: 'Erro Interno do Servidor',
        status: 500,
        detail: error.message,
        code: 'ERR_INTERNAL_SERVER'
      });
    }
  }
}
```

---

## 5. Suite de Testes Automatizados da Fase 08

```typescript
import { RegistroProficiencia } from '../../domain/entities/RegistroProficiencia';

describe('Fase 08 - Testes de Regra de Negócio Kumon (RN03)', () => {
  it('Deve manter o estudante como NÃO proficiente após apenas 1 teste com nota >= 85%', () => {
    const registro = new RegistroProficiencia('estudante-uuid-1', 'EF05MA03', 0, 0);
    
    registro.avaliarProgressoKumon(90.0);

    expect(registro.historicoConsecutivo).toBe(1);
    expect(registro.ehProficiente).toBe(false);
  });

  it('Deve conceder status PROFICIENTE após 2 testes consecutivos com nota >= 85% (RN03)', () => {
    const registro = new RegistroProficiencia('estudante-uuid-1', 'EF05MA03', 90.0, 1);
    
    registro.avaliarProgressoKumon(88.5);

    expect(registro.historicoConsecutivo).toBe(2);
    expect(registro.ehProficiente).toBe(true);
  });

  it('Deve resetar o contador consecutivo e revogar proficiência se a nota for inferior a 85%', () => {
    const registro = new RegistroProficiencia('estudante-uuid-1', 'EF05MA03', 90.0, 1, false);
    
    registro.avaliarProgressoKumon(70.0);

    expect(registro.historicoConsecutivo).toBe(0);
    expect(registro.ehProficiente).toBe(false);
  });
});
```
