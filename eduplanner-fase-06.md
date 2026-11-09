# Implementação da Fase 06: Módulo de Planejamento Didático e Recursos (EduPlanner)

## 1. Visão Geral da Fase 06
A Fase 06 implementa o motor de planejamento didático multinível (diário, semanal, mensal, anual) e o gerador de recursos pedagógicos (roteiros de slides e bancos de questões objetivas/discursivas com gabarito). Esta fase garante que todos os planos possuam vínculo estrito com códigos da BNCC (**RN01**) e definam estratégias de avaliação (**RN06**).

---

## 2. Agregados de Domínio (DDD)

### Entidade `PlanoDidatico`:
```typescript
import { AggregateRoot } from '../core/AggregateRoot';
import { DomainException } from '../exceptions/DomainException';

export enum EscopoTemporal {
  DIARIO = 'DIARIO',
  SEMANAL = 'SEMANAL',
  MENSAL = 'MENSAL',
  ANUAL = 'ANUAL'
}

export class PlanoDidatico extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly turmaId: string,
    public readonly escopo: EscopoTemporal,
    public readonly metodologia: string,
    public readonly dataPlanejada: Date,
    private codigosBNCC: Set<string>,
    private recursos: RecursoDidatico[] = []
  ) {
    super();
    this.validarInvariantes();
  }

  private validarInvariantes(): void {
    if (!this.codigosBNCC || this.codigosBNCC.size === 0) {
      throw new DomainException(
        'RN01: Todo plano didático deve estar vinculado a pelo menos um código da BNCC.',
        'ERR_RN01_BNCC_OBRIGATORIA'
      );
    }
    if (!this.metodologia || this.metodologia.trim().length === 0) {
      throw new DomainException(
        'RN06: O plano didático deve conter a metodologia e as estratégias de avaliação.',
        'ERR_RN06_AVALIACAO_OBRIGATORIA'
      );
    }
  }

  public adicionarRecurso(recurso: RecursoDidatico): void {
    this.recursos.push(recurso);
  }

  public getCodigosBNCC(): string[] {
    return Array.from(this.codigosBNCC);
  }

  public getRecursos(): RecursoDidatico[] {
    return [...this.recursos];
  }
}
```

### Entidade `RecursoDidatico`:
```typescript
export enum TipoRecurso {
  SLIDE = 'SLIDE',
  ATIVIDADE_OBJETIVA = 'ATIVIDADE_OBJETIVA',
  ATIVIDADE_DISCURSIVA = 'ATIVIDADE_DISCURSIVA'
}

export enum NivelDificuldade {
  FACIL = 'FACIL',
  MEDIO = 'MEDIO',
  DIFICIL = 'DIFICIL'
}

export class RecursoDidatico {
  constructor(
    public readonly id: string,
    public readonly planoId: string,
    public readonly tipo: TipoRecurso,
    public readonly conteudoJson: object,
    public readonly nivelDificuldade: NivelDificuldade,
    public readonly codigoBNCC: string
  ) {}
}
```

---

## 3. Casos de Uso da Aplicação

### `ElaborarPlanoDidaticoUseCase`:
```typescript
import { PlanoDidatico, EscopoTemporal } from '../../domain/entities/PlanoDidatico';
import { IPlanoDidaticoRepository } from '../../domain/repositories/IPlanoDidaticoRepository';

export interface CriarPlanoDTO {
  turmaId: string;
  escopo: EscopoTemporal;
  metodologia: string;
  dataPlanejada: string;
  codigosBNCC: string[];
}

export class ElaborarPlanoDidaticoUseCase {
  constructor(private planoRepo: IPlanoDidaticoRepository) {}

  public async execute(dto: CriarPlanoDTO): Promise<{ planoId: string }> {
    const plano = new PlanoDidatico(
      crypto.randomUUID(),
      dto.turmaId,
      dto.escopo,
      dto.metodologia,
      new Date(dto.dataPlanejada),
      new Set(dto.codigosBNCC)
    );

    await this.planoRepo.salvar(plano);
    return { planoId: plano.id };
  }
}
```

---

## 4. Controlador REST (`/api/v1/planos`)

```typescript
import { Request, Response } from 'express';
import { ElaborarPlanoDidaticoUseCase } from '../../application/usecases/ElaborarPlanoDidaticoUseCase';

export class PlanoDidaticoController {
  constructor(private criarPlanoUseCase: ElaborarPlanoDidaticoUseCase) {}

  public criar = async (req: Request, res: Response): Promise<Response> => {
    try {
      const result = await this.criarPlanoUseCase.execute(req.body);
      return res.status(201).json(result);
    } catch (error: any) {
      if (error.code === 'ERR_RN01_BNCC_OBRIGATORIA' || error.code === 'ERR_RN06_AVALIACAO_OBRIGATORIA') {
        return res.status(422).json({
          type: 'errors/business-rule-violation',
          title: 'Violação de Regra de Negócio',
          status: 422,
          detail: error.message,
          code: error.code
        });
      }
      return res.status(500).json({ title: 'Erro Interno', status: 500, detail: error.message });
    }
  };
}
```

---

## 5. Suite de Testes Automatizados da Fase 06

```typescript
import { PlanoDidatico, EscopoTemporal } from '../../domain/entities/PlanoDidatico';

describe('Fase 06 - Testes de Domínio do Planejamento Didático', () => {
  it('Deve criar um plano didático com sucesso quando houver habilidades BNCC (RN01)', () => {
    const plano = new PlanoDidatico(
      'plano-1',
      'turma-1',
      EscopoTemporal.SEMANAL,
      'Metodologia ativa com rotação por estações.',
      new Date(),
      new Set(['EF05MA01', 'EF05MA02'])
    );

    expect(plano.id).toBe('plano-1');
    expect(plano.getCodigosBNCC()).toHaveLength(2);
  });

  it('Deve lançar exceção ao tentar criar plano sem código BNCC (RN01)', () => {
    expect(() => {
      new PlanoDidatico(
        'plano-2',
        'turma-1',
        EscopoTemporal.DIARIO,
        'Aula expositiva.',
        new Date(),
        new Set([])
      );
    }).toThrow('RN01: Todo plano didático deve estar vinculado a pelo menos um código da BNCC.');
  });
});
```
