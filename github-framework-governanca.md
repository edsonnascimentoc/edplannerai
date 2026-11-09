# Framework de Adoção e Governança do GitHub: Do Repositório à Comunidade

Este documento estabelece o guia oficial de arquitetura e governança para a plataforma **GitHub**, abrangendo desde o provisionamento de repositórios até o engajamento com a comunidade. 

> **Regra Pétrea de Arquitetura:** Nenhum recurso do ecossistema GitHub deve ser ativado por padrão (*out-of-the-box*) ou por conveniência sem que seja previamente submetido à **Matriz de Tripla Validação**:
> 1. **Maturidade Técnica da Equipe:** Nível de domínio do fluxo de trabalho Git e disciplinas de engenharia.
> 2. **Escopo e Criticidade do Projeto:** Impacto operacional, volume de dados, exigências regulatórias e ciclo de vida (MVP vs. Core Enterprise).
> 3. **Solicitação e Acordo da Equipe:** Avaliação de necessidade real manifestada pelos desenvolvedores para evitar sobrecarga de processos e ferramentas (*tool fatigue* / *overengineering*).

---

## Matriz Geral de Avaliação de Elegibilidade (Gatekeeper)

Antes de habilitar qualquer funcionalidade descrita nos módulos a seguir, aplique o seguinte fluxo decisório:

```
[Demanda de Recurso / Feature]
               │
               ▼
   [Análise de Escopo e Criticidade]
   ├── MVP / Prova de Conceito ────────► Habilitar apenas recursos essenciais (baixo atrito)
   └── Sistema Crítico / Enterprise ───► Exigir automação, auditoria e controles rígidos
               │
               ▼
   [Nível de Maturidade da Equipe]
   ├── Nível 1 (Básico / Formação) ───► Foco em fluxos padronizados e convenções simples
   ├── Nível 2 (Intermediário) ───────► Proteção de branch, automações de PR e CI básica
   └── Nível 3 (Avançado / SRE) ──────► DevSecOps completo, CodeQL, SBOM, RBAC refinado
               │
               ▼
   [Solicitação e Validação dos Devs]
   ├── Há consenso / RFC aprovada? ──► Sim: Configurar e documentar no repositório
   └── Não há consenso ou adesão? ───► Não: Rejeitar para não sufocar o fluxo de entrega
```

---

## 1. Criação e Estruturação de Repositórios

### Visão do Recurso
Provisionamento do repositório Git, definição de visibilidade (público vs. privado), organização hierárquica (organizações corporativas vs. contas individuais) e inicialização de arquivos essenciais (`.gitignore`, `README.md`, `LICENSE`, `CODEOWNERS`).

### Análise Prévia Obrigatória
* **Maturidade da Equipe:** Equipes no estágio inicial devem começar com estruturas planas e arquivos padrão gerados via template organizacional; equipes maduras podem operar modelos monorepo ou multi-repo coordenados.
* **Escopo do Projeto:** Para MVPs internos, um único repositório privado com visibilidade restrita ao time é suficiente. Para projetos com múltiplos serviços interdependentes ou microsserviços, avalia-se monorepo com regras de path ou múltiplos repositórios via GitHub Organization.
* **Solicitação do Time:** O desenvolvedor ou Tech Lead deve justificar a criação por meio de RFC ou ticket de trabalho, evitando a proliferação desordenada de repositórios órfãos.

### Padrão de Configuração e Governança
* **Nomenclatura Padronizada:** `<dominio>-<servico/componente>-<tipo>` (ex.: `eduplanner-api-backend`, `eduplanner-web-frontend`).
* **Arquivos Mínimos Obrigatórios:**
  - `README.md`: Propósito do projeto, pré-requisitos, instruções de build e links para diagramas de arquitetura.
  - `.gitignore`: Estritamente configurado para a stack tecnológica, impedindo check-in de binários, diretórios de build (`dist/`, `target/`) e arquivos locais.
  - `CODEOWNERS`: Mapeamento explícito de responsabilidade técnica por diretório ou módulo.

---

## 2. Codificação Colaborativa

### Visão do Recurso
Mecanismos de trabalho em equipe no código: fluxos de ramificação (Gitflow / GitHub Flow / Trunk-based), Pull Requests (PRs), revisões de código, regras de proteção de branch (*Branch Protection Rules* / *Rulesets*), GitHub Discussions e GitHub Codespaces.

### Análise Prévia Obrigatória
* **Maturidade da Equipe:**
  - *Básico:* GitHub Flow simplificado (branches de feature com PR diretamente para `main`), exigindo 1 aprovação de par.
  - *Intermediário/Avançado:* Branch protection estrita com merge linear (Squash ou Rebase), bloqueio de force push e exigência de aprovações de membros específicos via `CODEOWNERS`.
* **Escopo do Projeto:**
  - *Projetos Pequenos/MVPs:* Evitar excesso de burocracia de aprovações para não travar a velocidade de validação de hipóteses de negócio.
  - *Projetos Regulados / Críticos:* Exigir assinaturas digitais de commit (GPG/SSH commit signing), revisões obrigatórias e histórico linear estrito.
* **Solicitação do Time:** Definição conjunta em sessão técnica de alinhamento. A imposição de fluxos complexos sem concordância dos desenvolvedores gera bypass de regras ou estagnação de PRs.

### Diretrizes de Implementação
* **Políticas de Branch (Regras Mínimas):**
  - Proibição de push direto na branch principal (`main` / `develop`).
  - Exigência de Pull Request com status checks aprovados (CI verde).
  - Bloqueio de merge se houver threads de conversa abertas no PR.
* **Ambientes de Desenvolvimento Efêmeros (GitHub Codespaces):**
  - Habilitar sob demanda quando o setup de máquina local do time for heterogêneo ou complexo, padronizando o ambiente via `.devcontainer/devcontainer.json`.

---

## 3. GitHub Copilot e Ferramentas de IA

### Visão do Recurso
Extensões e agentes assistidos por IA para desenvolvimento: autocompletar de código (*Completions*), *Copilot Chat*, modo agente (*Agent Mode*), *Copilot CLI*, instruções customizadas (`.github/copilot-instructions.md`) e integração com servidores MCP (*Model Context Protocol*).

### Análise Prévia Obrigatória
* **Maturidade da Equipe:** A equipe deve ter sólida disciplina de testes unitários e revisão crítica de código. O desenvolvedor deve atuar como autor e validador, e não como aceitador passivo de código gerado por IA.
* **Escopo do Projeto:** Projetos sob restrições contratuais de sigilo ou propriedade intelectual exigem avaliação prévia das políticas de retenção de dados e bloqueio de sugestões correspondentes a código público aberto (*public code matching*).
* **Solicitação do Time:** Liberação condicionada ao pedido do desenvolvedor, que deve receber orientações sobre segurança, mitigação de alucinações e proibição de inclusão de credenciais em prompts.

### Diretrizes de Governança
* **Instruções Compartilhadas:** Manter o arquivo `.github/copilot-instructions.md` no repositório descrevendo convenções de nomenclatura, bibliotecas aprovadas e regras de arquitetura para contextualizar a IA.
* **Exclusão de Conteúdo Confidencial:** Configurar a exclusão de arquivos com dados sensíveis (`.env*`, certificados, schemas privados) para impedir sua leitura por agentes de IA.
* **Revisão Humana Inegociável:** Nenhuma sugestão do Copilot é promovida para branch protegida sem revisão humana de código e aprovação em suíte de testes.

---

## 4. CI/CD e DevOps (GitHub Actions & Packages)

### Visão do Recurso
Automação do ciclo de vida da aplicação através de pipelines declarativas em YAML (*GitHub Actions*), gerenciamento de artefatos e contêineres (*GitHub Packages*) e publicação estática (*GitHub Pages*).

### Análise Prévia Obrigatória
* **Maturidade da Equipe:** 
  - *Nível Inicial:* Pipelines restritas à compilação e execução de testes unitários a cada push em PR.
  - *Nível Avançado:* Deploys automatizados por ambientes (*Environments*), aprovações manuais para produção, testes de carga, automação de release e gerenciamento de imagens Docker.
* **Escopo do Projeto:** Dimensionar a complexidade do pipeline ao SLA do produto. Não construir esteiras hiperfragmentadas com múltiplos estágios desnecessários para sistemas em fase de descoberta (MVP).
* **Solicitação do Time:** O desenho dos workflows deve ser construído em parceria direta com os desenvolvedores da aplicação para assegurar tempos de execução rápidos (evitar pipelines que demorem mais de 10 minutos).

### Padrão de Configuração
* **Segurança na Execução de Actions:** Fixar actions externas por hash de commit SHA e não por tag mutável (ex.: `uses: actions/checkout@b4ffde...` em vez de `@v4`) para mitigar ataques na cadeia de suprimentos.
* **Gestão de Segredos:** Segredos de repositório e de ambiente gerenciados via *GitHub Secrets* com escopo segregado entre desenvolvimento, homologação e produção.

---

## 5. Qualidade de Código e Segurança (GitHub Advanced Security)

### Visão do Recurso
Recursos de segurança contínua integrados ao fluxo de desenvolvimento: varredura estática de código (*CodeQL / Code Scanning*), gerenciamento de dependências vulneráveis (*Dependabot Alerts & Updates*), detecção e bloqueio de credenciais (*Secret Scanning & Push Protection*) e governança da cadeia de suprimentos de software (*SBOM*).

### Análise Prévia Obrigatória
* **Maturidade da Equipe:** Iniciar com alertas informativos antes de configurar bloqueios rígidos no pipeline. Habilitar bloqueios prematuros (*fail on warning*) sem que a equipe saiba como resolver os débitos técnicos gera frustração e incentivo a contornar as ferramentas.
* **Escopo do Projeto:** Crítico para qualquer sistema que manipule dados pessoais (LGPD), transações financeiras ou APIs expostas à internet. Para protótipos internos descartáveis, manter o foco em Secret Scanning e alertas básicos do Dependabot.
* **Solicitação do Time:** O time de desenvolvimento deve ser capacitado na interpretação dos relatórios SAST/SCA para agir preventivamente nas correções.

### Diretrizes de Habilitação Gradual
1. **Push Protection:** Ativação prioritária e imediata para impedir que chaves de API, senhas ou tokens sejam comitados no repositório.
2. **Dependabot Security Updates:** Configurar PRs automáticos para correção de vulnerabilidades de dependências com limites de PRs abertos simultaneamente para não poluir o backlog.
3. **CodeQL Scan:** Execução programada ou acionada em PRs para a branch principal, focando inicialmente nas vulnerabilidades de severidade Alta e Crítica.

---

## 6. Aplicativos Cliente e Produtividade

### Visão do Recurso
Interfaces e ferramentas clientes oficiais do ecossistema GitHub: *GitHub CLI (`gh`)*, *GitHub Desktop*, aplicativo móvel (*GitHub Mobile*) e extensões para IDEs (Visual Studio, VS Code, JetBrains).

### Análise Prévia Obrigatória
* **Maturidade da Equipe:** Liberdade para cada desenvolvedor escolher a interface mais adequada à sua produtividade, desde que respeite as regras de commit e autenticação da organização.
* **Escopo do Projeto:** Requisitos de governança corporativa podem exigir o uso obrigatório do *Git Credential Manager* com autenticação multifator (MFA/SSO) e proibição de chaves SSH sem expiração ou desprotegidas por senha.
* **Solicitação do Time:** Treinamentos em GitHub CLI (`gh`) são recomendados para desenvolvedores com perfil de automação e scripts.

---

## 7. Gerenciamento de Projetos (GitHub Issues & Projects)

### Visão do Recurso
Rastreamento de demandas, bugs, tarefas e roadmaps utilizando *GitHub Issues*, *Issue Templates*, *Tasklists*, visualizações Kanban/Tabela no *GitHub Projects* e vinculação automática com commits e PRs.

### Análise Prévia Obrigatória
* **Maturidade da Equipe:**
  - Se a organização já adota uma ferramenta corporativa oficial de ALM/Jira/Azure Boards, evite duplicar o tracking no GitHub Projects sem sincronização automatizada para não gerar silos de informação.
  - Se o GitHub for a ferramenta primária de gestão, estabeleça modelos padronizados de issues (*Bug Report*, *Feature Request*).
* **Escopo do Projeto:** Definir a granularidade dos itens. Em projetos ágeis pequenos, um quadro Kanban integrado com 3 a 4 colunas (*Todo*, *In Progress*, *In Review*, *Done*) é suficiente.
* **Solicitação do Time:** A equipe deve definir os marcos (*Milestones*) e tags de classificação (*Labels*), garantindo que as issues representem incrementos reais de valor para o produto.

---

## 8. Recursos para Desenvolvedores (APIs, Apps & Webhooks)

### Visão do Recurso
Capacidades de integração programática com o GitHub: *GitHub Apps*, *Webhooks*, *REST API* e *GraphQL API* para sincronização com ferramentas corporativas (Slack, Teams, sistemas de chamados, auditoria).

### Análise Prévia Obrigatória
* **Maturidade da Equipe:** Requer senioridade técnica para gerenciar o ciclo de vida de tokens de acesso, rotação de chaves e tratamento de falhas em webhooks idempotentes.
* **Escopo do Projeto:** Justificado quando há necessidade de orquestração externa, governança automatizada de permissões ou métricas personalizadas de engenharia (*DORA Metrics*).
* **Solicitação do Time:** Toda automação ou bot integrado via GitHub App deve possuir documentação técnica no repositório indicando escopo de permissões mínimas necessárias (*Principle of Least Privilege*).

---

## 9. Governança de Comunidade e Código Aberto

### Visão do Recurso
Estruturações voltadas ao engajamento com contribuidores e usuários: arquivos de saúde do repositório (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`), *GitHub Discussions* e patrocínio via *GitHub Sponsors*.

### Análise Prévia Obrigatória
* **Maturidade da Equipe:** Exigido quando o repositório for de código aberto (Open Source) ou atuar como biblioteca corporativa compartilhada (*InnerSource*). Requer equipe com disponibilidade para triagem e moderação.
* **Escopo do Projeto:** Repositórios puramente privados de produtos internos não necessitam de `CONTRIBUTING.md` complexos voltados à comunidade externa, mas se beneficiam de uma política de segurança transparente (`SECURITY.md`) para reporte responsável de vulnerabilidades.
* **Solicitação do Time:** Decisão estratégica entre equipe técnica, liderança de produto e jurídico da organização.

---

## Checklist de Habilitação por Nível de Maturidade

| Recurso GitHub | MVP / Time Inicial | Médio Porte / Intermediário | Enterprise / Crítico |
| :--- | :---: | :---: | :---: |
| **README & .gitignore padronizados** | **Obrigatório** | **Obrigatório** | **Obrigatório** |
| **Branch Protection Rules (Bloqueio Push Direto)** | Recomendado | **Obrigatório** | **Obrigatório** |
| **Exigência de 2+ Revisores de PR** | Opcional | Recomendado | **Obrigatório** |
| **CI com Testes Unitários Automatizados** | Recomendado | **Obrigatório** | **Obrigatório** |
| **Secret Scanning & Push Protection** | **Obrigatório** | **Obrigatório** | **Obrigatório** |
| **Instruções Customizadas Copilot (.github/)** | Opcional | Recomendado | **Obrigatório** |
| **CodeQL (SAST) em Pull Requests** | Não recomendado | Recomendado | **Obrigatório** |
| **Dependabot com Auto-fix de Vulnerabilidades** | Opcional | **Obrigatório** | **Obrigatório** |
| **Ambientes com Aprovação Manual de Deploy** | Não aplicável | Opcional | **Obrigatório** |
| **CODEOWNERS e Restrição de Merge** | Opcional | Recomendado | **Obrigatório** |
| **GitHub Codespaces padronizado** | Opcional | Opcional | Recomendado |
