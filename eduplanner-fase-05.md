# Implementação da Fase 05: Motor de Análise SWOT Pedagógica (`UC02` - `/gerar_SWOT`) - EduPlanner

## 1. Visão Geral da Fase 05
A Fase 05 implementa o motor analítico para consolidação e geração da Matriz SWOT Pedagógica (Forças, Fraquezas, Oportunidades e Ameaças) com base nos resultados da avaliação diagnóstica (`UC01`). Esta fase garante o cumprimento da regra de negócio **RN02** (Disparo de Análise SWOT condicionado a 80% de preenchimento do diagnóstico) e a persistência atômica dos itens da matriz na tabela `tb_item_swot` (1FN).

---

## 2. Agregado de Domínio (`MatrizSWOT` & `ItemSWOT`)

```typescript
export enum DimensaoSWOT {
  FORCA = 'FORCA',
  FRAQUEZA = 'FRAQUEZA',
  OPORTUNIDADE = 'OPORTUNIDADE',
  AMEACA = 'AMEACA'
}

export class ItemSWOT {
  constructor(
    public readonly id: string,
    public readonly matrizId: string,
    public readonly codigoBNCC: string,
    public readonly dimensao: DimensaoSWOT,
    public readonly observacaoPedagogica: string
  ) {}
}

export class MatrizSWOT {
  private _itens: ItemSWOT[] = [];

  constructor(
    public readonly id: string,
    public readonly avaliacaoId: string,
    public readonly dataGeracao: Date = new Date()
  ) {}

  public get itens(): ReadonlyArray<ItemSWOT> {
    return this._itens;
  }

  public adicionarItem(item: ItemSWOT): void {
    this._itens.push(item);
  }
}
```

---

## 3. Caso de Uso (`GerarMatrizSwotUseCase`)

```typescript
export class GerarMatrizSwotUseCase {
  constructor(
    private readonly avaliacaoRepo: IAvaliacaoDiagnosticaRepository,
    private readonly swotRepo: IMatrizSwotRepository,
    private readonly llmAdapter: ILlmAdapter
  ) {}

  public async execute(avaliacaoId: string): Promise<MatrizSWOT> {
    const avaliacao = await this.avaliacaoRepo.findById(avaliacaoId);
    if (!avaliacao) {
      throw new NotFoundError('Avaliação diagnóstica não encontrada', 'ERR_AVALIACAO_NOT_FOUND');
    }

    // Regra de Negócio RN02: Mínimo de 80% de preenchimento
    if (avaliacao.percentualPreenchimento < 80.0) {
      throw new BusinessRuleError(
        'A avaliação diagnóstica deve possuir no mínimo 80% de preenchimento para gerar a SWOT.',
        'ERR_RN02_INCOMPLETO',
        422
      );
    }

    // Classificação Determinística de Habilidades e Enriquecimento Analítico
    const desempenhoBNCC = avaliacao.obterDesempenhoPorHabilidade();
    const matriz = new MatrizSWOT(uuidv4(), avaliacaoId);

    for (const [codigoBNCC, taxaAcerto] of Object.entries(desempenhoBNCC)) {
      let dimensao: DimensaoSWOT;
      if (taxaAcerto >= 80) {
        dimensao = DimensaoSWOT.FORCA;
      } else if (taxaAcerto < 50) {
        dimensao = DimensaoSWOT.FRAQUEZA;
      } else {
        dimensao = DimensaoSWOT.OPORTUNIDADE;
      }

      matriz.adicionarItem(
        new ItemSWOT(
          uuidv4(),
          matriz.id,
          codigoBNCC,
          dimensao,
          `Desempenho de ${taxaAcerto.toFixed(1)}% na habilidade ${codigoBNCC}.`
        )
      );
    }

    await this.swotRepo.save(matriz);
    return matriz;
  }
}
```

---

## 4. Controlador REST (`/api/v1/swot/gerar`)

```typescript
import { Router, Request, Response, NextFunction } from 'express';

export const swotRouter = Router();

swotRouter.post('/gerar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { avaliacaoId } = req.body;
    const useCase = req.container.resolve(GerarMatrizSwotUseCase);
    
    const matriz = await useCase.execute(avaliacaoId);
    
    return res.status(200).json({
      matrizId: matriz.id,
      avaliacaoId: matriz.avaliacaoId,
      dataGeracao: matriz.dataGeracao,
      itensSwot: matriz.itens.map(item => ({
        dimensao: item.dimensao,
        codigoBNCC: item.codigoBNCC,
        observacao: item.observacaoPedagogica
      }))
    });
  } catch (error) {
    next(error);
  }
});
```

---

## 5. Suite de Testes Automatizados da Fase 05

```typescript
describe('Fase 05 - Testes do Motor de Análise SWOT', () => {
  it('Deve barrar geração da SWOT se preenchimento < 80% (RN02)', async () => {
    const avaliacaoMock = { percentualPreenchimento: 75.0 };
    const repoMock = { findById: jest.fn().mockResolvedValue(avaliacaoMock) };
    const useCase = new GerarMatrizSwotUseCase(repoMock as any, {} as any, {} as any);

    await expect(useCase.execute('id-123')).rejects.toThrow('ERR_RN02_INCOMPLETO');
  });

  it('Deve classificar acertos >= 80% como FORCA', async () => {
    const avaliacaoMock = {
      percentualPreenchimento: 100.0,
      obterDesempenhoPorHabilidade: () => ({ EF05MA01: 85.0 })
    };
    const repoMock = { findById: jest.fn().mockResolvedValue(avaliacaoMock) };
    const swotRepoMock = { save: jest.fn().mockResolvedValue(null) };

    const useCase = new GerarMatrizSwotUseCase(repoMock as any, swotRepoMock as any, {} as any);
    const matriz = await useCase.execute('id-123');

    expect(matriz.itens[0].dimensao).toBe('FORCA');
  });
});
```
