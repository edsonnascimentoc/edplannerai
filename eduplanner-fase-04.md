# Implementação da Fase 04: Core de Avaliação Diagnóstica (UC01 - /iniciar_avaliacao) - EduPlanner

## 1. Visão Geral da Fase 04
A Fase 04 implementa o **Core de Avaliação Diagnóstica (`UC01`)**, responsável por iniciar, aplicar e corrigir testes diagnósticos vinculados à matriz de habilidades da BNCC. Esta fase garante que todas as respostas dos alunos sejam registradas de forma atômica por código BNCC (`RN01`), permitindo o cálculo em tempo real do percentual de preenchimento para liberação da análise SWOT (`RN02`).

---

## 2. Modelagem do Agregado de Avaliação Diagnóstica (Domain)

### Entidade `AvaliacaoDiagnostica`:
```typescript
import { v4 as uuidv4 } from 'uuid';

export enum StatusAvaliacao {
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  CONCLUIDA = 'CONCLUIDA'
}

export interface RespostaItemProps {
  id?: string;
  codigoHabilidadeBNCC: string;
  correta: boolean;
}

export class AvaliacaoDiagnostica {
  private id: string;
  private matriculaId: string;
  private status: StatusAvaliacao;
  private percentualPreenchimento: number;
  private respostas: RespostaItemProps[];
  private dataCriacao: Date;

  constructor(matriculaId: string, id?: string) {
    this.id = id || uuidv4();
    this.matriculaId = matriculaId;
    this.status = StatusAvaliacao.EM_ANDAMENTO;
    this.percentualPreenchimento = 0;
    this.respostas = [];
    this.dataCriacao = new Date();
  }

  public registrarRespostas(novasRespostas: RespostaItemProps[], totalItensEsperados: number): void {
    this.respostas = [...this.respostas, ...novasRespostas];
    
    // Atualiza percentual de preenchimento
    this.percentualPreenchimento = Number(
      ((this.respostas.length / totalItensEsperados) * 100).toFixed(2)
    );

    // Se respondeu 100% dos itens, altera status para CONCLUIDA
    if (this.respostas.length >= totalItensEsperados) {
      this.status = StatusAvaliacao.CONCLUIDA;
    }
  }

  public permiteGerarSwot(): boolean {
    // RN02: Mínimo de 80% de preenchimento exigido
    return this.percentualPreenchimento >= 80.0;
  }

  // Getters
  public getId(): string { return this.id; }
  public getMatriculaId(): string { return this.matriculaId; }
  public getStatus(): StatusAvaliacao { return this.status; }
  public getPercentualPreenchimento(): number { return this.percentualPreenchimento; }
  public getRespostas(): RespostaItemProps[] { return this.respostas; }
}
```

---

## 3. Serviços de Aplicação (Use Cases)

### `IniciarAvaliacaoDiagnosticaUseCase`:
```typescript
export interface IniciarAvaliacaoInput {
  matriculaId: string;
  disciplina: string;
  anoEscolar: string;
}

export class IniciarAvaliacaoDiagnosticaUseCase {
  constructor(
    private matriculaRepo: IMatriculaRepository,
    private bnccRepo: IBnccRepository,
    private avaliacaoRepo: IAvaliacaoRepository
  ) {}

  async execute(input: IniciarAvaliacaoInput) {
    // 1. Validar se a matrícula existe e está ATIVA
    const matricula = await this.matriculaRepo.findById(input.matriculaId);
    if (!matricula || matricula.status !== 'ATIVA') {
      throw new Error('MATRICULA_INVALIDA_OU_INATIVA');
    }

    // 2. Buscar habilidades BNCC para a disciplina e ano
    const habilidades = await this.bnccRepo.buscarPorAnoEDisciplina(input.anoEscolar, input.disciplina);
    if (!habilidades || habilidades.length === 0) {
      throw new Error('SEM_HABILIDADES_BNCC_MAPEADAS');
    }

    // 3. Instanciar e salvar nova avaliação diagnóstica
    const avaliacao = new AvaliacaoDiagnostica(input.matriculaId);
    await this.avaliacaoRepo.salvar(avaliacao);

    return {
      avaliacaoId: avaliacao.getId(),
      status: avaliacao.getStatus(),
      itensBNCC: habilidades.map(h => ({
        codigoBNCC: h.codigo,
        descricao: h.descricao
      }))
    };
  }
}
```

---

## 4. Controlador REST (`/api/v1/avaliacoes/diagnostico`)

```typescript
import { Request, Response } from 'express';

export class AvaliacaoController {
  constructor(
    private iniciarUseCase: IniciarAvaliacaoDiagnosticaUseCase,
    private submeterUseCase: SubmeterRespostasUseCase
  ) {}

  async iniciar(req: Request, res: Response) {
    try {
      const { matriculaId, disciplina, anoEscolar } = req.body;
      const result = await this.iniciarUseCase.execute({ matriculaId, disciplina, anoEscolar });
      return res.status(201).json(result);
    } catch (error: any) {
      if (error.message === 'MATRICULA_INVALIDA_OU_INATIVA') {
        return res.status(404).json({
          type: 'errors/not-found',
          title: 'Matrícula Não Encontrada',
          status: 404,
          detail: 'A matrícula informada não existe ou não está ativa.',
          code: 'ERR_MATRICULA_INATIVA'
        });
      }
      return res.status(500).json({
        type: 'errors/internal-error',
        title: 'Erro Interno',
        status: 500,
        detail: error.message
      });
    }
  }
}
```

---

## 5. Suite de Testes Automatizados da Fase 04

```typescript
import { AvaliacaoDiagnostica, StatusAvaliacao } from '../../domain/entities/AvaliacaoDiagnostica';

describe('Fase 04 - Core de Avaliação Diagnóstica (UC01)', () => {
  it('Deve calcular corretamente o percentual de preenchimento', () => {
    const avaliacao = new AvaliacaoDiagnostica('mat-123');
    
    // Submete 4 respostas de um total de 5 itens esperados (80%)
    avaliacao.registrarRespostas([
      { codigoHabilidadeBNCC: 'EF05MA01', correta: true },
      { codigoHabilidadeBNCC: 'EF05MA02', correta: false },
      { codigoHabilidadeBNCC: 'EF05MA03', correta: true },
      { codigoHabilidadeBNCC: 'EF05MA04', correta: true }
    ], 5);

    expect(avaliacao.getPercentualPreenchimento()).toBe(80.0);
    expect(avaliacao.permiteGerarSwot()).toBe(true); // Valida RN02
    expect(avaliacao.getStatus()).toBe(StatusAvaliacao.EM_ANDAMENTO);
  });

  it('Deve alterar o status para CONCLUIDA ao atingir 100% de preenchimento', () => {
    const avaliacao = new AvaliacaoDiagnostica('mat-123');
    
    avaliacao.registrarRespostas([
      { codigoHabilidadeBNCC: 'EF05MA01', correta: true },
      { codigoHabilidadeBNCC: 'EF05MA02', correta: true }
    ], 2);

    expect(avaliacao.getPercentualPreenchimento()).toBe(100.0);
    expect(avaliacao.getStatus()).toBe(StatusAvaliacao.CONCLUIDA);
  });
});
```
