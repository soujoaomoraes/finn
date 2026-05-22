# V1.1 Quality and Security Tasks

**Design**: `.specs/features/v1.1-quality-and-security/design.md`
**Status**: Approved | In Progress

---

## Execution Plan

### Phase 1: Foundation (Sequential)
*Ajustes de fundação. Preparação da folha de estilos global e remoção de código morto para dar um baseline limpo.*

```text
T1 → T10
```

### Phase 2: UI Redesign (Parallel OK)
*Aplicação do Design System tela a tela. Como os arquivos JS/CSS de cada tela são separados, eles podem rodar em paralelo após T1 e o componente base do Drawer.*

```text
       ┌→ T2 ─┐
T1 ──┼→ T3 ─┼──→ T4 (depende do T3 para Drawer)
       ├→ T5 ─┼──→ T6 (depende do T5 para Drawer)
       ├→ T7 ─┤
       ├→ T8 ─┤
       └→ T9 ─┘
```

### Phase 3: Security & Observability (Parallel OK)
*Mudanças no backend. A limpeza de `oauth.rs` (T10) destrava as integrações seguintes.*

**Refatoração obrigatória nesta fase**: ao implementar T11–T13, quebrar o `oauth.rs` por responsabilidade para evitar que OAuth, backup, restore e armazenamento de tokens continuem concentrados em um único arquivo grande. A divisão deve preservar as assinaturas públicas expostas ao Tauri.

```text
         ┌→ T11 ─┐
T10 ──┼→ T12 ─┤
         ├→ T13 ─┤
         └→ T14 ─┘
```

### Phase 4: Testing & Validation (Parallel OK)
*Adição da camada de testes. Podem ocorrer paralelamente ao longo ou final do projeto.*

```text
T15
T16
T17 (O ideal é ocorrer após a Phase 2 estar completa)
```

---

## Task Breakdown

### Phase 1: Foundation

#### T1: [Design System Tokens & Fonte]
**What**: Substituir as variáveis CSS no `index.css` pelas variáveis Warm Dark e carregar fonte Inter.
**Where**: `src/index.css` e `src/index.html`
**Depends on**: None
**Tests**: none
**Gate**: quick (`npm run build`)
**Done when**:
- [x] Fonte Inter injetada e DMs removidas.
- [x] Todas as variáveis CSS atualizadas para os valores do `finledger_design_system_final.html`.

#### T10: [Limpeza oauth.rs]
**What**: Remover `REDIRECT_URI`, `OAuthToken`, warnings e colocar allow dead_code.
**Where**: `src-tauri/src/db/oauth.rs`
**Depends on**: None
**Tests**: none
**Gate**: quick (`cargo check`)
**Done when**:
- [x] O código não gera warnings durante o `cargo check`.

---

### Phase 2: UI Redesign

#### T3: [Drawer de Transação]
**What**: Criar o componente JS/CSS de Drawer e acoplá-lo para Nova/Editar Transação.
**Where**: `src/components/drawer.js`, `src/components/drawer.css`, e tela de Nova Transação.
**Depends on**: T1
**Tests**: none
**Gate**: quick
**Done when**:
- [x] O form abre em um Drawer de 380px pela lateral direita.
- [x] Overlay aparece sob o Drawer; cliques no overlay fecham o drawer.

#### T4: [Tela Transações - Visual e Filtros] [P]
**What**: Ajustar visual da lista (dot color, badges pills) e filtros de 4 colunas.
**Where**: `src/screens/transacoes.js`, `src/screens/transacoes.css`
**Depends on**: T3
**Tests**: none
**Gate**: quick
**Done when**:
- [x] Valores monetários verdes/vermelhos, rows com `--s3` de hover.

#### T2: [Dashboard Completo] [P]
**What**: Migrar Dashboard para grid de 4 colunas, evolução em linha SVG e barras de progresso empilhadas das categorias.
**Where**: `src/screens/dashboard.js`, `src/screens/dashboard.css`
**Depends on**: T1
**Tests**: none
**Gate**: quick
**Done when**:
- [x] Painel reflete perfeitamente os mockups (month-nav integrado, SVG atualizando com pills).

#### T5: [Drawer de Recorrente] [P]
**What**: Reutilizar o componente drawer criado na T3 para o form de Nova Recorrente.
**Where**: `src/screens/recorrentes.js` (ou componente do form recorrente).
**Depends on**: T3
**Tests**: none
**Gate**: quick
**Done when**:
- [x] Drawer funciona perfeitamente para as Recorrentes com abas de tipo.

#### T6: [Tela Recorrentes - Visual] [P]
**What**: Atualizar badges, cores e icon buttons na lista de recorrentes.
**Where**: `src/screens/recorrentes.js`, `src/screens/recorrentes.css`
**Depends on**: T5
**Tests**: none
**Gate**: quick
**Done when**:
- [x] Status chips (Ativa/Pausada) e botões secundários atualizados.

#### T7: [Tela Categorias - Visual] [P]
**What**: Layout em 2 colunas e redesign do modal de Nova Categoria e paleta de swatches.
**Where**: `src/screens/categorias.js`, `src/screens/categorias.css`
**Depends on**: T1
**Tests**: none
**Gate**: quick
**Done when**:
- [x] 12 cores de swatches, layout de 2 colunas alinhado ao topo.

#### T8: [Tela Importar/Exportar] [P]
**What**: Layout 2 colunas, visualização da área de Dropzone.
**Where**: `src/screens/importar.js`
**Depends on**: T1
**Tests**: none
**Gate**: quick
**Done when**:
- [x] UI de inputs de data e área tracejada arrastável com states atualizados.

#### T9: [Tela Backup] [P]
**What**: Card de status do Google Drive e Cloud indicator azul na Topbar.
**Where**: `src/screens/backup.js` e navbar
**Depends on**: T1
**Tests**: none
**Gate**: quick
**Done when**:
- [x] Último backup mostra timestamp formatado corretamente, e status chips sincronizando.

---

### Phase 3: Security & Observability

#### T11: [Logging Estruturado] [P]
**What**: Instalar `log` e `env_logger` no Cargo.toml, espalhar nas operações cruciais do DB/OAuth e iniciar a separação do `oauth.rs` por responsabilidade quando tocar nos fluxos críticos.
**Where**: `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, `src-tauri/src/db/*.rs`
**Depends on**: T10
**Tests**: none
**Gate**: build (`cargo check`)
**Done when**:
- [ ] Substituição completa de `eprintln!` por logs da crate.
- [ ] Fluxos de OAuth/backup afetados pela tarefa ficam em módulos coesos, sem concentrar novas responsabilidades em `oauth.rs`.

#### T12: [Renovação Automática OAuth Token] [P]
**What**: Validação `< 5min` antes do expirar no fluxo de backup, batendo na API para renovar silenciosamente, com a lógica de token extraída para módulo próprio.
**Where**: `src-tauri/src/db/backup.rs`, `src-tauri/src/db/token_store.rs` (novo, se necessário), `src-tauri/src/db/oauth.rs`
**Depends on**: T10
**Tests**: none
**Gate**: full
**Done when**:
- [ ] Upload ocorre silenciosamente com sucesso mesmo se passado mais de 1hr do login original.
- [ ] Leitura, gravação e renovação de tokens não ficam misturadas ao listener/callback OAuth em `oauth.rs`.

#### T13: [Armazenamento em Cofre Nativo] [P]
**What**: Instalar tauri-plugin-stronghold; migrar a leitura/escrita dos tokens do SQLite para ele.
**Where**: `src-tauri/src/db/token_store.rs` (novo), `src-tauri/src/db/oauth.rs`, `src-tauri/src/db/backup.rs`
**Depends on**: T10
**Tests**: none
**Gate**: full
**Done when**:
- [ ] Token nunca escrito no banco; app lembra da sessão após restartar.
- [ ] Existe um módulo coeso de armazenamento seguro de tokens, usado por OAuth e Backup, sem duplicação de queries/metadata sensível.

#### T14: [Encriptação SQLCipher] [P]
**What**: Ativar cipher feature no `rusqlite` / tauri-sql, ler ou criar a DB-key no Vault, criar hook de migração do db em texto puro existente.
**Where**: `src-tauri/Cargo.toml`, `src-tauri/src/db/mod.rs`
**Depends on**: T10
**Tests**: none
**Gate**: full
**Done when**:
- [ ] Banco de dados não é mais legível num DB Browser sem a chave encriptada.

---

### Phase 4: Testing

#### T15: [Unitários Backend Recorrentes] [P]
**What**: Adicionar test module em `recorrentes.rs` garantindo lógica de pulos e anos.
**Where**: `src-tauri/src/db/recorrentes.rs`
**Depends on**: None
**Tests**: unit
**Gate**: test (`cargo test`)
**Done when**:
- [ ] Os 6 cenários exigidos na Spec são aprovados no `cargo test`.

#### T16: [Mock Banco de Dados em RAM] [P]
**What**: Preparar a trait/conexão que permite os testes injetarem um bd `:memory:` rodando as migrações em tempo de build.
**Where**: `src-tauri/src/db/mod.rs` ou `test_utils.rs`
**Depends on**: None
**Tests**: unit
**Gate**: test
**Done when**:
- [ ] Testes CRUD (save_transacao) quebrando sem tocar na persistência principal.

#### T17: [Suite E2E WebdriverIO] [P]
**What**: Implementar test runner via skill `testing-tauri-apps` rodando os 7 fluxos exigidos.
**Where**: `test/e2e/*.test.js`
**Depends on**: T2, T3, T4, T5, T6, T7, T8
**Tests**: e2e
**Gate**: full (`npm run test:e2e`)
**Done when**:
- [ ] Runner passa com sucesso nos fluxos estipulados de usuário.
