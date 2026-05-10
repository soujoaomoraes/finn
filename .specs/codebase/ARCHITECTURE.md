# ARCHITECTURE.md — FinLedger: Finanças Pessoais
**Versão:** V0.5  
**Plataforma:** Tauri 2.x (Windows / macOS / Linux) + Vite  
**Última atualização:** Maio 2026

---

## 1. Visão Geral da Arquitetura

O Caixa é um app desktop construído com **Tauri 2**. O Tauri age como uma casca nativa que embute um webview com o frontend HTML/JS. A comunicação entre frontend e o sistema operacional (incluindo o banco de dados) acontece via **commands** do Tauri, chamados com `invoke()` no JavaScript.

```
┌─────────────────────────────────────────────┐
│                  Tauri Shell                │
│                                             │
│  ┌──────────────────┐  invoke()  ┌────────┐ │
│  │   Frontend       │ ────────── │  Rust  │ │
│  │   HTML/CSS/JS    │ ←───────── │ Backend│ │
│  │   (Webview)      │            │        │ │
│  └──────────────────┘            └───┬────┘ │
│                                      │      │
│                               ┌──────▼────┐ │
│                               │  SQLite   │ │
│                               │  (local)  │ │
│                               └───────────┘ │
└─────────────────────────────────────────────┘
```

O frontend é **vanilla HTML/CSS/JS** — exatamente o mesmo código do protótipo original, com a única diferença de que as chamadas ao IndexedDB são substituídas por `invoke()` para o backend Rust.

---

## 2. Stack Tecnológico

| Camada | Tecnologia | Versão | Motivo |
|---|---|---|---|
| Shell nativo | Tauri | 2.x | Empacota o app como executável desktop |
| Backend | Rust | stable | Linguagem padrão do Tauri |
| Banco de dados | SQLite via `tauri-plugin-sql` | 2.x | Persistência local, sem servidor |
| Bundler/Dev Server | Vite | 5.x/6.x | HMR, build rápido e suporte a ES Modules |
| Frontend | HTML + CSS + JS (vanilla modular) | — | Refatorado para módulos (ESM) |
| Parser de planilha | SheetJS (xlsx.js) | 0.18.x | Via CDN local para importar dados |
| Tipografia | Syne + Instrument Sans | — | Identidade visual V0.5 (Google Fonts) |

---

## 3. Estrutura de Pastas

```
finledger/
├── docs/                       # Documentação e contexto para IA
│   ├── SPEC.md                 # O que o app faz (telas, regras, comportamentos)
│   ├── ARCHITECTURE.md         # Como o app está estruturado (este arquivo)
│   ├── TASKS.md                # Tarefas do MVP em ordem de execução
│   └── prompts/                # Prompts reutilizáveis por contexto
│       ├── nova-feature.md     # Template para pedir uma feature nova à IA
│       └── corrigir-bug.md     # Template para reportar e corrigir bugs
│
├── src/                        # Frontend Modular (HTML/CSS/JS)
│   ├── index.html              # Fica na raiz do projeto (Vite exige)
│   ├── main.js                 # Ponto de entrada JS (importa módulos e componentes)
│   ├── styles.css              # Variáveis e CSS global
│   ├── db.js                   # Camada de comunicação (invoke) com backend
│   ├── router.js               # Lógica de navegação entre telas
│   ├── utils.js                # Funções de formatação (data, moeda)
│   ├── toast.js                # Lógica de feedback visual
│   ├── components/             # Componentes reutilizáveis (sidebar, drawer)
│   ├── screens/                # Telas da aplicação (um JS e CSS por tela)
│   └── assets/
│       └── xlsx.full.min.js    # SheetJS local (não CDN externo)
│
├── src-tauri/                  # Backend Rust (gerenciado pelo Tauri)
│   ├── src/
│   │   ├── main.rs             # Ponto de entrada do app Tauri
│   │   ├── lib.rs              # Registro dos commands e setup do app
│   │   └── db/
│   │       ├── mod.rs          # Módulo de banco de dados
│   │       ├── schema.rs       # CREATE TABLE e migrations
│   │       ├── transacoes.rs   # CRUD de transações
│   │       └── categorias.rs   # CRUD de categorias
│   ├── Cargo.toml              # Dependências Rust
│   └── tauri.conf.json         # Configuração do Tauri (janela, permissões, etc.)
│
├── package.json                # Scripts ("dev": "vite", "build": "vite build")
└── vite.config.js              # Configuração do Vite (porta 1420)
```

> **Nota sobre a pasta `docs/`:** é o ponto de entrada para qualquer IA que trabalhar no projeto. Antes de pedir código, sempre forneça `SPEC.md` + `ARCHITECTURE.md` como contexto. Os arquivos em `prompts/` são templates reutilizáveis para não precisar reescrever o contexto do zero a cada sessão.

> **Nota sobre o frontend:** Na migração para V0.5, o código foi modularizado. Em vez de arquivos únicos e gigantes, usamos a abordagem de módulos ES com Vite. Cada tela possui seu próprio arquivo `.js` e `.css` (ex: `screens/dashboard.js`). Os scripts são importados em `main.js` como ES Modules.

---

## 4. Banco de Dados

### 4.1 Localização do arquivo

O SQLite é armazenado na pasta de dados do app, gerenciada automaticamente pelo Tauri:

| Sistema | Caminho |
|---|---|
| Windows | `C:\Users\<user>\AppData\Roaming\finledger\finledger.db` |
| macOS | `~/Library/Application Support/finledger/finledger.db` |
| Linux | `~/.config/finledger/finledger.db` |

### 4.2 Schema SQL

```sql
-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categorias (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT    NOT NULL,
  tipo      TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa')),
  cor       TEXT    NOT NULL
);

-- Tabela de transações
CREATE TABLE IF NOT EXISTS transacoes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao  TEXT    NOT NULL,
  valor      REAL    NOT NULL CHECK(valor > 0),
  data       TEXT    NOT NULL,
  tipo       TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa')),
  categoria  TEXT    NOT NULL,
  obs        TEXT    DEFAULT ''
);
```

### 4.3 Inicialização

Ao iniciar o app, o backend Rust executa:
1. Cria as tabelas se não existirem (`CREATE TABLE IF NOT EXISTS`)
2. Verifica se a tabela `categorias` está vazia
3. Se estiver vazia, executa o seed com as 11 categorias padrão (ver SPEC.md seção 3)

---

## 5. Commands Tauri (contrato frontend ↔ backend)

Estes são os commands Rust expostos ao frontend via `invoke()`. Cada command mapeia diretamente a uma função que o protótipo HTML chamava no IndexedDB.

### 5.1 Transações

```
invoke("get_all_transacoes")
  → Vec<Transacao>
  Retorna todas as transações ordenadas por data decrescente.

invoke("save_transacao", { transacao: Transacao })
  → i64 (id gerado ou id existente)
  Se transacao.id for null/0: INSERT.
  Se transacao.id tiver valor: UPDATE.

invoke("delete_transacao", { id: number })
  → void
  Remove a transação pelo id.
```

### 5.2 Categorias

```
invoke("get_all_categorias")
  → Vec<Categoria>
  Retorna todas as categorias.

invoke("save_categoria", { categoria: Categoria })
  → i64 (id gerado ou id existente)
  Se categoria.id for null/0: INSERT.
  Se categoria.id tiver valor: UPDATE.

invoke("delete_categoria", { id: number })
  → void
  Remove a categoria pelo id.
```

### 5.3 Estrutura dos tipos (TypeScript-like para referência do frontend)

```typescript
type Transacao = {
  id?:       number   // ausente em novos registros
  descricao: string
  valor:     number   // sempre positivo
  data:      string   // YYYY-MM-DD
  tipo:      "receita" | "despesa"
  categoria: string   // nome da categoria
  obs:       string   // pode ser string vazia
}

type Categoria = {
  id?:  number        // ausente em novos registros
  nome: string
  tipo: "receita" | "despesa"
  cor:  string        // hex, ex: "#fb923c"
}
```

---

## 6. Migração do IndexedDB para invoke()

Esta é a única mudança de código relevante no frontend. A tabela abaixo mapeia cada chamada do protótipo para o equivalente Tauri:

| Protótipo (IndexedDB) | Tauri V0 (invoke) |
|---|---|
| `await dbGetAll('transacoes')` | `await invoke('get_all_transacoes')` |
| `await dbGetAll('categorias')` | `await invoke('get_all_categorias')` |
| `await dbPut('transacoes', obj)` | `await invoke('save_transacao', { transacao: obj })` |
| `await dbPut('categorias', obj)` | `await invoke('save_categoria', { categoria: obj })` |
| `await dbDelete('transacoes', id)` | `await invoke('delete_transacao', { id })` |
| `await dbDelete('categorias', id)` | `await invoke('delete_categoria', { id })` |

A função `initDB()` e as funções `dbGetAll`, `dbPut`, `dbDelete` são **removidas** do frontend. O restante da lógica JS (renderização, filtros, formatação) permanece intacto.

---

## 7. Configuração do Tauri (`tauri.conf.json`)

Pontos relevantes para a V0:

```json
{
  "app": {
    "windows": [
      {
        "title": "FinLedger",
        "width": 1100,
        "height": 720,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true
      }
    ]
  },
  "plugins": {
    "sql": {
      "preload": ["sqlite:finledger.db"]
    }
  }
}
```

---

## 8. Dependências Rust (`Cargo.toml`)

```toml
[dependencies]
tauri          = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde          = { version = "1", features = ["derive"] }
serde_json     = "1"
rusqlite       = { version = "0.31", features = ["bundled"] }
tokio          = { version = "1", features = ["full"] }
```

---

## 9. Fluxo de Dados — Exemplo Completo

**Usuário salva uma nova transação:**

```
1. Usuário preenche o formulário e clica em "Salvar"
2. JS valida os campos (descrição, valor, data)
3. JS chama: invoke('save_transacao', { transacao: obj })
4. Rust recebe o objeto, executa INSERT no SQLite
5. Rust retorna o id gerado
6. JS atualiza o array local `transacoes[]` com o novo id
7. JS redireciona para a tela de Transações
8. JS chama renderLancamentos() e renderDashboard()
9. Toast "Transação salva!" aparece por 2,8s
```

---

## 10. Recursos Externos — Política para Build Local

O protótipo HTML carregava recursos externos. Em um app Tauri idealmente arquivos devem ser locais para funcionar sem internet.

| Recurso | V0.5 Vite/Tauri |
|---|---|
| Tipografia | Syne e Instrument Sans (Google Fonts ou locais) |
| SheetJS (xlsx.js) | Servido de `src/assets/xlsx.full.min.js` |
