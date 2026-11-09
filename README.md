# EduPlanner API

Base técnica da Fase 1, em TypeScript e Express, organizada em camadas de domínio,
aplicação, infraestrutura e apresentação.

## Requisitos

- Node.js 22 ou superior
- PostgreSQL com a extensão TimescaleDB habilitada
- Redis
- Um coletor OpenTelemetry OTLP HTTP (opcional para execução local)

## Executar

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env` e ajuste as URLs de PostgreSQL, Redis e OTLP.
3. Execute `npm run dev` para desenvolvimento ou `npm run build` e `npm start`
   para produção.
4. Execute `npm test` para compilar e rodar a suíte de testes.

## Endpoints

- `GET /healthz`: liveness; não depende de serviços externos.
- `GET /readyz`: readiness; verifica PostgreSQL, extensão TimescaleDB e Redis.
  Retorna `503` quando qualquer dependência obrigatória está indisponível.

Erros HTTP seguem o formato `application/problem+json`, com identificador de
rastreamento. Logs são JSON em stdout; spans HTTP são exportados via OTLP e seus
IDs são correlacionados nos logs quando há um span ativo.
