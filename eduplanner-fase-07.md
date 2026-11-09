# Implementação da Fase 07: Motor de Adaptação de Conteúdo Acessível (`UC04` - `/adaptar_conteudo`) - EduPlanner

## 1. Visão Geral e Invariantes de Domínio
A **Fase 07** contempla o desenvolvimento do motor de acessibilidade e personalização de linguagem (`UC04`). O objetivo é reestruturar textos e atividades pedagógicas para atender a estudantes com necessidades específicas (ex.: TDAH, Espectro Autista, Dislexia, Baixa Visão), preservando obrigatoriamente a habilidade da BNCC original.

### Invariantes de Domínio e Regras de Negócio:
- **`RN01 - Rastreabilidade BNCC Mantida`**: O conteúdo adaptado deve herdar e manter estritamente o código de habilidade BNCC do plano didático de origem.
- **`RN05 - Inviolabilidade da Acessibilidade`**: A reescrita pode alterar vocabulário, estrutura sintática e suporte visual, mas **jamais pode simplificar ou anular o objetivo pedagógico** previsto pela habilidade da BNCC.
- **Integração com Privacy Gateway**: Todo o texto base enviado ao modelo de IA passa previamente pela anonimização de PII estabelecida na Fase 02.

---

## 2. Modelagem de Domínio (`ConteudoAdaptado`)

```typescript
import { v4 as uuidv4 } from 'uuid';

export class ConteudoAdaptado {
  private constructor(
    public readonly idAdaptacao: string,
    public readonly idPlano: string,
    public readonly idMatricula: string,
    public readonly codigoHabilidadeBNCC: string,
    public readonly perfilNecessidade: string,
    public readonly textoAdaptado: string,
    public readonly recursosAplicados: string[],
    public readonly dtCriacao: Date
  ) {}

  public static criar(params: {
    idPlano: string;
    idMatricula: string;
    codigoHabilidadeBNCC: string;
    perfilNecessidade: string;
    textoAdaptado: string;
    recursosAplicados: string[];
  }): ConteudoAdaptado {
    if (!params.codigoHabilidadeBNCC || params.codigoHabilidadeBNCC.trim() === '') {
      throw new Error('RN01_VIOLATION: O conteúdo adaptado deve possuir vínculo obrigatório com a BNCC.');
    }

    if (!params.textoAdaptado || params.textoAdaptado.length < 20) {
      throw new Error('RN05_VIOLATION: O conteúdo adaptado não possui densidade pedagógica suficiente.');
    }

    return new ConteudoAdaptado(
      uuidv4(),
      params.idPlano,
      params.idMatricula,
      params.codigoHabilidadeBNCC,
      params.perfilNecessidade,
      params.textoAdaptado,
      params.recursosAplicados,
      new Date()
    );
  }
}
```

---

## 3. Caso de Uso da Aplicação (`AdaptarConteudoAcessivelUseCase`)

```typescript
export interface AdaptarConteudoInputDTO {
  idMatricula: string;
  idPlano: string;
  perfilNecessidade: 'TDAH' | 'AUTISMO' | 'DISLEXIA' | 'BAIXA_VISAO';
}

export class AdaptarConteudoAcessivelUseCase {
  constructor(
    private readonly planoRepo: IPlanoDidaticoRepository,
    private readonly matriculaRepo: IMatriculaRepository,
    private readonly adaptacaoRepo: IConteudoAdaptadoRepository,
    private readonly privacyGateway: IPrivacyGatewayService,
    private readonly llmAdapter: ILlmAdapter
  ) {}

  public async execute(dto: AdaptarConteudoInputDTO): Promise<ConteudoAdaptado> {
    // 1. Valida existência da matrícula ativa e do plano
    const matricula = await this.matriculaRepo.findById(dto.idMatricula);
    if (!matricula || matricula.stMatricula !== 'ATIVA') {
      throw new DomainException('ERR_MATRICULA_INATIVA', 'A matrícula informada não está ativa.', 404);
    }

    const plano = await this.planoRepo.findById(dto.idPlano);
    if (!plano) {
      throw new DomainException('ERR_PLANO_NOT_FOUND', 'Plano didático de origem não encontrado.', 404);
    }

    // 2. Anonimiza PII antes do envio à IA (Fase 02 - LGPD)
    const promptBruto = `Reescreva o conteúdo pedagógico a seguir para um estudante com ${dto.perfilNecessidade}.
Mantenha o foco absoluto na habilidade BNCC ${plano.codigosBNCC.join(', ')}.
Conteúdo Original: ${plano.dsMetodologia}`;

    const promptAnonimizado = this.privacyGateway.anonymize(promptBruto, [
      { realName: matricula.nomeEstudante }
    ]);

    // 3. Processamento via LLM Adapter
    const resultadoIa = await this.llmAdapter.gerarTextoAcessivel(promptAnonimizado, dto.perfilNecessidade);

    // 4. Restaura PII no retorno
    const textoFinal = this.privacyGateway.deanonymize(resultadoIa.texto);

    // 5. Instancia Entidade de Domínio (Valida RN01 e RN05)
    const adaptacao = ConteudoAdaptado.criar({
      idPlano: plano.idPlano,
      idMatricula: matricula.idMatricula,
      codigoHabilidadeBNCC: plano.codigosBNCC[0],
      perfilNecessidade: dto.perfilNecessidade,
      textoAdaptado: textoFinal,
      recursosAplicados: resultadoIa.recursos
    });

    // 6. Persistência
    await this.adaptacaoRepo.salvar(adaptacao);

    return adaptacao;
  }
}
```

---

## 4. Controlador REST (`/api/v1/conteudos/adaptar`)

```typescript
import { Router, Request, Response, NextFunction } from 'express';

export const adaptacaoRouter = Router();

adaptacaoRouter.post('/adaptar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase: AdaptarConteudoAcessivelUseCase = req.app.get('AdaptarConteudoAcessivelUseCase');
    const resultado = await useCase.execute(req.body);

    return res.status(200).json({
      adaptacaoId: resultado.idAdaptacao,
      idPlano: resultado.idPlano,
      idMatricula: resultado.idMatricula,
      codigoHabilidadeBNCC: resultado.codigoHabilidadeBNCC,
      perfilNecessidade: resultado.perfilNecessidade,
      textoAdaptado: resultado.textoAdaptado,
      recursosAplicados: resultado.recursosAplicados,
      dtCriacao: resultado.dtCriacao.toISOString()
    });
  } catch (error) {
    next(error);
  }
});
```

---

## 5. Suite de Testes Automatizados da Fase 07

```typescript
describe('Fase 07 - Adaptação de Conteúdo Acessível (UC04)', () => {
  it('Deve criar adaptação mantendo o código da BNCC e aplicando recursos de acessibilidade (RN01)', () => {
    const adaptacao = ConteudoAdaptado.criar({
      idPlano: 'plano-uuid-123',
      idMatricula: 'mat-uuid-456',
      codigoHabilidadeBNCC: 'EF05MA03',
      perfilNecessidade: 'TDAH',
      textoAdaptado: 'Texto estruturado com frases curtas e destacadores visuais para apoio pedagógico.',
      recursosAplicados: ['FRASES_CURTAS', 'DESTAQUE_VISUAL']
    });

    expect(adaptacao.codigoHabilidadeBNCC).toBe('EF05MA03');
    expect(adaptacao.recursosAplicados).toContain('FRASES_CURTAS');
  });

  it('Deve lançar erro de violação caso tente criar conteúdo adaptado sem código BNCC (RN01)', () => {
    expect(() => {
      ConteudoAdaptado.criar({
        idPlano: 'plano-123',
        idMatricula: 'mat-456',
        codigoHabilidadeBNCC: '',
        perfilNecessidade: 'AUTISMO',
        textoAdaptado: 'Texto adaptado sem código de habilidade.',
        recursosAplicados: []
      });
    }).toThrow('RN01_VIOLATION');
  });
});
```
