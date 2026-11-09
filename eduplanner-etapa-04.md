# Etapa 04: Preparação de Ambiente, Pipeline CI/CD e Implementação Incremental (**EduPlanner**)

## 1. Governança de Código e Estratégia de Branching (Gitflow)

Adotamos o modelo **Gitflow** adaptado para integração contínua e entregas em microsserviços/módulos coesos:

```
main (Production) ───────────────────────────────────────────● (v1.0.0)
                                                            /
staging (HML)     ─────────────────● (v1.0.0-rc1) ─────────┼
                                  /                       /
develop (Dev)     ───● ──────────┼───────● ──────────────┼
                    \           /       \              /
feature/*            ●─────────┘         ●────────────┘ (feat/modulo-swot)
```

### Regras de Branching e Convenção:
* **`main`**: Reflete o ambiente de Produção. Somente aceita mesclagens vindas de `staging` ou `hotfix/*` via Pull Requests (PRs) aprovados.
* **`staging`**: Ambiente de Homologação (HML) para testes de carga e validação pedagógica.
* **`develop`**: Branch principal de integração do desenvolvimento.
* **`feature/<id-issue>-<nome-curto>`**: Branches de funcionalidade (ex.: `feature/EP-102-diagnostico-bncc`).
* **`hotfix/<id-issue>-<descricao>`**: Correções urgentes em produção.
* **Convenção de Commits (Conventional Commits):** `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`.
* **Políticas de Pull Request (PR):**
  - Aprovação mínima de **2 desenvolvedores seniores**.
  - Passagem obrigatória nos testes automatizados da pipeline (Status Check verde).
  - Análise estática sem inconsistências graves (*Quality Gate* do SonarQube aprovado).

---

## 2. Automação de CI/CD e Qualidade de Código (GitHub Actions)

A pipeline automatizada garante a execução contínua de testes unitários, análise de segurança (SAST/SCA), empacotamento de contêineres e deploy com zero *downtime*.

```yaml
name: EduPlanner CI/CD Pipeline

on:
  push:
    branches: [ develop, staging, main ]
  pull_request:
    branches: [ develop, staging ]

jobs:
  static-analysis-and-test:
    name: Análise Estática & Testes Unitários
    runs-on: ubuntu-latest
    steps:
      - name: Checkout do Código
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Configurar Ambiente Runtime
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Instalar Dependências
        run: npm ci

      - name: Executar Testes Unitários e Cobertura
        run: npm run test:coverage

      - name: Análise Estática com SonarQube (SAST)
        uses: SonarSource/sonarqube-scan-action@v2
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}

      - name: Varredura de Vulnerabilidades em Dependências (SCA)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          ignore-unfixed: true
          severity: 'CRITICAL,HIGH'

  build-and-push:
    name: Build & Push de Imagem Docker
    needs: static-analysis-and-test
    if: github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout do Código
        uses: actions/checkout@v4

      - name: Login no Registry de Container
        uses: docker/login-action@v3
        with:
          registry: ${{ secrets.CONTAINER_REGISTRY_URL }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build e Push da Imagem Otimizada (Multi-stage)
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ secrets.CONTAINER_REGISTRY_URL }}/eduplanner-api:${{ github.sha }}
            ${{ secrets.CONTAINER_REGISTRY_URL }}/eduplanner-api:latest

  deploy-staging:
    name: Deployment Reversível (Staging)
    needs: build-and-push
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Executar Migração de Banco de Dados (Flyway/Liquibase)
        run: |
          echo "Executando scripts DDL/DML de migração no PostgreSQL/TimescaleDB..."

      - name: Deploy na Nuvem (Azure Container Apps / K8s)
        run: |
          echo "Atualizando imagem no cluster de Staging via Helm/Kubectl..."
```

---

## 3. Gestão de Segredos e Variáveis de Ambiente

Para evitar o vazamento de credenciais e atender às exigências de segurança do **RNF01 (LGPD)** e **RNF05 (OWASP)**:

### Estrutura de Injeção de Segredos:
* **Desenvolvimento Local:** Arquivo `.env` ignorado pelo Git (`.gitignore`).
* **Staging / Produção:** Os segredos são injetados diretamente na memória do contêiner via **Azure Key Vault / HashiCorp Vault** no momento da inicialização (*runtime*).

### Matriz de Variáveis do Sistema (`.env.example`):
```env
# Configurações da Aplicação
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# Banco de Dados (PostgreSQL + TimescaleDB)
DB_HOST=eduplanner-db.internal
DB_PORT=5432
DB_NAME=eduplanner_db
DB_USER=app_eduplanner
DB_PASSWORD_SECRET_REF=vault:secrets/db/password

# Autenticação e Segurança
JWT_SECRET_REF=vault:secrets/auth/jwt-secret
OIDC_ISSUER_URL=https://auth.eduplanner.saas/realms/eduplanner

# Integração com Modelos de Inteligência Artificial
LLM_PRIMARY_PROVIDER=gemini
LLM_PRIMARY_API_KEY_REF=vault:secrets/ia/gemini-key
LLM_SECONDARY_PROVIDER=openai
LLM_SECONDARY_API_KEY_REF=vault:secrets/ia/openai-key

# Cache Redis (BNCC e Sessões)
REDIS_HOST=eduplanner-redis.internal
REDIS_PORT=6379
```

---

## 4. Plano de Implementação Incremental Priorizado

```
[Fase 1: Fundação & Observabilidade]
         │
         ▼
[Fase 2: Segurança, Auth & Privacy Gateway]
         │
         ▼
[Fase 3: Módulo BNCC, Cursos, Turmas e Matrículas]
         │
         ▼
[Fase 4: Core de Avaliação Diagnóstica (/iniciar_avaliacao)]
         │
         ▼
[Fase 5: Módulo de Análise SWOT Pedagógica (/gerar_SWOT)]
         │
         ▼
[Fase 6: Módulo de Planejamento Didático e Recursos (/planejar_aula)]
         │
         ▼
[Fase 7: Módulo de Adaptação de Conteúdo Acessível (/adaptar_conteudo)]
         │
         ▼
[Fase 8: Acompanhamento Periódico Kumon & TimescaleDB (/avaliar_progresso)]
         │
         ▼
[Fase 9: Painel Analítico e Dashboards (UC08)]
```

### Detalhamento das Fases:

#### **Fase 1: Fundação Técnica, Logs e Observabilidade Base**
* **Objetivo:** Estabelecer a estrutura da arquitetura limpa (Clean Architecture), middleware de tratamento global de exceções, health checks (`/healthz`, `/readyz`) e exportação de logs estruturados em JSON (Serilog/Winston) integrados ao OpenTelemetry.

#### **Fase 2: Segurança, Autenticação e Privacy Gateway (LGPD)**
* **Objetivo:** Implementar autenticação OAuth2/OIDC, controle de acesso baseado em papéis (RBAC - Professor, Coordenador, Aluno) e o middleware de descaracterização de dados sensíveis (PII) antes de qualquer chamada para APIs de IA.

#### **Fase 3: Módulo de Cadastro da BNCC, Cursos, Turmas e Matrículas**
* **Objetivo:** Carga inicial do catálogo oficial de habilidades da BNCC e disponibilização dos endpoints de gestão de cursos, turmas e matrículas (3FN).

#### **Fase 4: Core de Avaliação Diagnóstica (`UC01` - `/iniciar_avaliacao`)**
* **Objetivo:** Permitir a seleção das habilidades por ano escolar, geração de itens diagnósticos, registro das respostas dos estudantes e cálculo do percentual de acertos por habilidade BNCC.

#### **Fase 5: Motor de Análise SWOT Pedagógica (`UC02` - `/gerar_SWOT`)**
* **Objetivo:** Implementar a validação da regra de preenchimento de 80% (`RN02`), integração com o orquestrador de IA e persistência estruturada dos itens da matriz na tabela `tb_item_swot` (1FN).

#### **Fase 6: Módulo de Planejamento Didático e Recursos (`UC05`/`UC06` - `/planejar_aula`, `/criar_recursos`)**
* **Objetivo:** Desenvolver a estrutura de planos de aula (diário, semanal, mensal, anual), vinculação de habilidades BNCC (`RN01`) e geração de roteiros de slides e banco de questões com gabarito.

#### **Fase 7: Motor de Adaptação de Conteúdo Acessível (`UC04` - `/adaptar_conteudo`)**
* **Objetivo:** Implementar o fluxo de reescrita de textos pedagógicos adaptados para necessidades específicas (TDAH, Autismo, Dislexia) com garantia de manutenção do código BNCC original (`RN05`).

#### **Fase 8: Acompanhamento Periódico Kumon e Séries Temporais (`UC07` - `/avaliar_progresso`)**
* **Objetivo:** Criar o mecanismo de avaliação curta periódica, cálculo da nota, controle do histórico consecutivo e validação da proficiência em duas tentativas ≥ 85% (`RN03`) com gravação no TimescaleDB.

#### **Fase 9: Painel Analítico e Dashboards de Desempenho (`UC08`)**
* **Objetivo:** Desenvolver as consultas agregadas para renderização dos gráficos de teia da BNCC e curvas de evolução temporal do aluno e da turma.
