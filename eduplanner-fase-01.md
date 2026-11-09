# Fase 1: Fundação Técnica, Logs e Observabilidade Base (**EduPlanner**)

Esta especificação orienta a equipe de desenvolvimento na implementação da **Fase 1**, estabelecendo a estrutura da solução em **Clean Architecture**, o tratamento global de exceções conforme a **RFC 7807 (Problem Details)**, logs estruturados em JSON integrados ao **OpenTelemetry** e mecanismos de **Health Check** para contêineres e orquestradores (Kubernetes/Docker).

---

## 1. Estrutura de Diretórios (Clean Architecture / DDD)

A aplicação é organizada em quatro camadas concêntricas independentes de frameworks externos:

```text
src/
├── domain/                         # CAMADA DE DOMÍNIO (Regras de Negócio Puras)
│   ├── entities/                   # Entidades e Agregados (Estudante, Avaliacao, Plano)
│   ├── value-objects/              # Objetos de Valor (CodigoBNCC, NotaPercentual)
│   ├── exceptions/                 # Exceções de Domínio (DominioException, RN02ViolationException)
│   └── repositories/               # Interfaces de Repositórios (IRepositorioEstudante, IRepositorioBNCC)
│
├── application/                    # CAMADA DE APLICAÇÃO (Casos de Uso e Orquestração)
│   ├── use-cases/                  # Implementação dos Casos de Uso (IniciarAvaliacaoUseCase, GerarSwotUseCase)
│   ├── dtos/                       # Data Transfer Objects (Request/Response DTOs)
│   └── interfaces/                 # Interfaces de Serviços Externos (IMotorIAService, ILoggerService)
│
├── infrastructure/                 # CAMADA DE INFRAESTRUTURA (Detalhes Técnicos e I/O)
│   ├── database/                   # Mapeamento ORM/SQL, Repositórios Concretos, Migrations
│   ├── external-services/          # Adaptações de APIs de IA (GeminiAdapter, OpenAIAdapter)
│   ├── logging/                    # Configuração do Logger Estruturado e OpenTelemetry
│   └── security/                   # Encriptação e Sanitização de PII (Privacy Gateway)
│
└── presentation/                   # CAMADA DE APRESENTAÇÃO (Entrada/Saída e Contratos)
    ├── http/
    │   ├── controllers/            # Controladores REST
    │   ├── middlewares/            # ErrorHandler, TraceIdMiddleware, AuthMiddleware
    │   └── routes/                 # Definições de Rotas HTTP
    └── health/                     # Endpoints de Probes (/healthz, /readyz)
```

---

## 2. Tratamento Global de Exceções (Padronização RFC 7807)

Todas as exceções não tratadas ou violações de regras de negócio são capturadas pelo `GlobalErrorHandlerMiddleware` e transformadas no formato padronizado **Problem Details (RFC 7807)**:

```json
{
  "type": "https://eduplanner.saas/errors/RN02_VIOLATION",
  "title": "Regra de Negócio Violada",
  "status": 422,
  "detail": "A avaliação diagnóstica possui apenas 65% de preenchimento. O cálculo da matriz SWOT exige no mínimo 80%.",
  "instance": "/api/v1/swot/gerar",
  "code": "ERR_RN02_INCOMPLETO",
  "timestamp": "2026-10-14T17:00:00Z",
  "traceId": "c4a9f8e7-1234-5678-9abc-def012345678"
}
```

### Implementação do Middleware de Erro (Typescript / Node.js):

```typescript
import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  type?: string;
}

export const globalErrorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const traceId = (req.headers['x-trace-id'] as string) || req.id || 'N/A';

  const problemDetails = {
    type: err.type || 'https://eduplanner.saas/errors/INTERNAL_SERVER_ERROR',
    title: statusCode >= 500 ? 'Erro Interno do Servidor' : 'Erro de Requisição',
    status: statusCode,
    detail: err.message || 'Ocorreu um erro inesperado no processamento.',
    instance: req.originalUrl,
    code: err.code || 'ERR_INTERNAL_SERVER',
    timestamp: new Date().toISOString(),
    traceId
  };

  // Log Estruturado
  console.error(JSON.stringify({
    event: 'HTTP_ERROR',
    statusCode,
    traceId,
    path: req.originalUrl,
    error: err.stack
  }));

  res.status(statusCode).type('application/problem+json').json(problemDetails);
};
```

---

## 3. Logs Estruturados & OpenTelemetry

Os logs são emitidos estritamente em formato **JSON chave-valor**, garantindo parsing automático em ferramentas de observabilidade (Elasticsearch, Datadog, Grafana Loki).

### Schema do Log Estruturado:
```json
{
  "@timestamp": "2026-10-14T17:00:00.123Z",
  "log.level": "INFO",
  "service.name": "eduplanner-api",
  "trace.id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span.id": "00f067aa0ba902b7",
  "event.category": "BUSINESS_LOGIC",
  "message": "Avaliação diagnóstica iniciada com sucesso",
  "context": {
    "estudanteId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "disciplina": "Matemática",
    "anoEscolar": "5º Ano EF"
  }
}
```

---

## 4. Endpoints de Health Check (Liveness & Readiness Probes)

Para integração com orquestradores de contêineres:

* **Liveness Probe (`/healthz`):** Indica se o processo da aplicação está rodando.
* **Readiness Probe (`/readyz`):** Verifica se as dependências de infraestrutura (PostgreSQL, TimescaleDB, Redis) estão operacionais antes de direcionar tráfego.

```typescript
import { Router, Request, Response } from 'express';

const healthRouter = Router();

// Probe de Vivacidade (Liveness)
healthRouter.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Probe de Prontidão (Readiness)
healthRouter.get('/readyz', async (_req: Request, res: Response) => {
  try {
    // Checagem de conectividade DB e Redis
    const dbOk = await checkDatabaseConnection();
    const redisOk = await checkRedisConnection();

    if (dbOk && redisOk) {
      res.status(200).json({
        status: 'READY',
        checks: { database: 'UP', redis: 'UP' },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(530).json({
        status: 'NOT_READY',
        checks: { database: dbOk ? 'UP' : 'DOWN', redis: redisOk ? 'UP' : 'DOWN' }
      });
    }
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: 'Falha na checagem de prontidão' });
  }
});

export default healthRouter;
```

---

## 5. Suite de Testes Unitários de Fundação

Exemplo de teste unitário validando a captura e formatação do middleware RFC 7807:

```typescript
import { globalErrorHandler } from '../../src/presentation/middlewares/globalErrorHandler';
import { Request, Response } from 'express';

describe('GlobalErrorHandlerMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction = jest.fn();

  beforeEach(() => {
    mockRequest = { originalUrl: '/api/v1/swot/gerar', headers: { 'x-trace-id': 'trace-123' } };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  it('deve formatar erro de regra de negócio como Problem Details RFC 7807', () => {
    const error = new Error('A avaliação deve possuir no mínimo 80% de preenchimento.');
    (error as any).statusCode = 422;
    (error as any).code = 'ERR_RN02_INCOMPLETO';

    globalErrorHandler(error as any, mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(422);
    expect(mockResponse.type).toHaveBeenCalledWith('application/problem+json');
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 422,
        code: 'ERR_RN02_INCOMPLETO',
        instance: '/api/v1/swot/gerar',
        traceId: 'trace-123'
      })
    );
  });
});
```
