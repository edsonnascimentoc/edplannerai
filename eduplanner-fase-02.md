# Implementação da Fase 02: Seguran÷a, Autenticação e Privacy Gateway (LGPD) - EduPlanner

## 1. Visão Geral da Fase 02
A Fase 02 estabelece a camada de seguran÷a defensiva, autentica÷ão baseada em padrões abertos (OAuth2/OIDC), controle de acesso por papéis (RBAC) e o **Privacy Gateway (Anonimização PII para LGPD)*. Esta fase garante que nenhum dado sensível de estudantes menores de idade seja trafegado sem criptografia ou enviado para modelos de Inteligência Artificial externos sem pseudonimização prévia (RNF01, RNF05).

---

## 2. Autenticaç��o e Autoriza÷ão (OAuth2 / OIDC + RBAC)

#7 Arquitetura de Autentica÷ão:
- **Provedor de Identidade (IdP): **OpenID Connect (OIDC) com suporte a JWT (JSON Web Tokens).
- **Validação de Tokens:** Middleware de verifica÷ão de assinatura de chave pública (JWKS) no Gateway/API.

##7 Papéis e Matriz de Acesso (RBAC):
- **ROLE_PROFESSOR**: Permissóo para criar/editar diagnósticos, gerar SWOT, planejar aulas, adaptar conteudos e visualizar dados da sua turma.
- **ROLE_COORDENADOR**: Acesso total a relatórios analíticos de todas as turmas, gestão de matréculas e auditoria.
- **ROLE_ESTUDANTE**: Acesso restrito para responder avaliações diagnósticas e testes periôdicos (Kumon) vinculados à sua prðpria matrícula.

##7 Middleware de Autoriza÷ão:
`l``typescript
import { Request, Response, NextFunction } from 'express';

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = req.user?.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({
        type: 'errors/forbidden',
        title: 'Acesso Negado',
        status: 403,
        detail: 'Você não possui o papel necessário para executar esta ação.',
        code: 'ERR_FORBIDDEN'
      });
    }
    next();
  };
};
`l``

---

## 3. Privacy Gateway (Anonimização de PII para LGPD)

##7 Diretriz da LGPD (Dados de Menores):
ANtes de enviar qualquer payload contendo dados textuais pedagógicos para provedores externos de IA, o **Privacy Gateway** intercepta o prompt, identifica termos elegíveis a PII (Nomes de Alunos, Documentos, E-mails) e substitui por tokens reversíveis em memòria (*hashes de sessão*).

##7 Fluxo do Middleware de Anonimização:

```[Requisi÷ão com PII] -> [Privacy Gateway] -> (Substitui Nomes por UUIDs) -> [API de LLM]
                                                                                     
[Resposta com PII]  <- [Privacy Gateway] <- (Restaura Nomes via Hash)   <- [Texto Gerado]
```

##7 Exemplo do Anonymizer Service:
`l``typescript
import { v4 as uuidv4 } from 'uuid';

export class PrivacyGatewayService {
  private tokenMap: Map<string, string> = new Map();  public anonymize(text: string, piiList: { realName: string }[]): string {
    let cleanText = text;
    for (const pii of piiList) {
      const anonToken = `[ALUNO_${uuidv4().substring(0, 8)}]`;
      this.tokenMap.set(anonToken, pii.realName);
      cleanText = cleanText.replaceAll(pii.realName, anonToken);    }
    return cleanText;  }

  public deanonymize(text: string): string {
    let restoredText = text;    this.tokenMap.forEach((realName, anonToken) => {
      restoredText = restoredText.replaceAll(anonToken, realName);
    });
    return restoredText;
  }
}
```

---

## 4. Proteções de Segurança

1. **Rate Limiting (Proteção DoS):**
  - Limite de 100 requisições por minuto por IP/Token no Gateway (Redis Rate Limiter).
2. **Injeção de Código & Sanitização:**
  - Valida÷ão de Schemas de entrada com Zod/Joi em todas as rotas de entrada.
- Parametrização estrita em todas as queries SQL (evitando SQL Injection).
3. **Cabe÷alos de Segurança (Helmet):**
  - Injeção obrigatória de Content-Security-Policy, X-Content-Type-Options: nosniff, X-Frame-Options: DENY e Strict-Transport-Security (HSTS).

---

## 5. Suite de Testes Automatizados da Fase 02

```typescript
import request from 'supertest';
import { app } from '../app';
import { PrivacyGatewayService } from '../../infrastructure/security/PrivacyGatewayService';

describe('Fase 02 - Testes de Seguran÷a e Privacy Gateway', () => {
  it('Deve barrar acesso sem token JWT (401 Unauthorized)', async () => {
    const res = await request(app).post('/api/v1/swot/gerar').send({});
    expect(res.status).toBe(401);
  });

  it('Deve anonimizar e desanonimizar nomes de estudantes corretamente', () => {
    const gateway = new PrivacyGatewayService();
    const originalPrompt = 'O aluno João Silva apresentou fraco desempenho em Matemática.';
    
    const anonymized = gateway.anonymize(originalPrompt, [{realName: 'João Silva'}]);
    expect(anonymized).not.to Contain('João Silva');
    expect(anonymized).match(/\[ALUNO_[A-Za-z0-9]+\]/);

    const restored = gateway.deanonymize(anonymized);
    expect(restored).toBe(originalPrompt);
  });
});
```
