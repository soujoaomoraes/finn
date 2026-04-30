# TASKS.md — FinLedger: Finanças Pessoais
**Versão:** V0  
**Última atualização:** Abril 2026

> Cada tarefa deve ser executada em ordem. Não avance para a próxima sem testar a atual.  
> Antes de abrir qualquer sessão com a IA, sempre forneça `SPEC.md` + `ARCHITECTURE.md` como contexto.

---

## Status

| # | Tarefa | Status |
|---|---|---|
| 1 | Criar o projeto Tauri | ✅ Concluído |
| 2 | Instalar dependências e configurar Tauri | ✅ Concluído |
| 3 | Baixar assets externos (fontes e SheetJS) | ✅ Concluído |
| 4 | Separar o protótipo em index.html + styles.css + main.js | ✅ Concluído |
| 5 | Criar o schema SQLite e inicialização do banco | ✅ Concluído |
| 6 | Implementar os commands Rust (CRUD) | ✅ Concluído |
| 7 | Registrar os commands no Tauri | ✅ Concluído |
| 8 | Migrar o frontend: substituir IndexedDB por invoke() | ✅ Concluído |
| 9 | Testar o app completo | ✅ Concluído |
| 10 | Gerar o build final | ✅ Concluído |

Legenda: ⬜ pendente · 🔄 em andamento · ✅ concluído

---

## TASK 01 — Criar o projeto Tauri

**O que fazer:**  
Inicializar o projeto Tauri 2 na máquina usando o CLI oficial.

**Pré-requisitos (instalar antes):**
- Node.js (LTS) — https://nodejs.org
- Rust (stable) — https://rustup.rs
- Dependências do sistema operacional listadas em https://tauri.app/start/prerequisites/

**Comando para criar o projeto:**
```bash
npm create tauri-app@latest finledger
```

Quando o CLI perguntar:
- **Project name:** finledger
- **Frontend language:** HTML + CSS + JS (Vanilla)
- **Package manager:** npm

**Resultado esperado:**  
Pasta `caixa/` criada com a estrutura base do Tauri. O app já deve abrir uma janela em branco com `npm run tauri dev`.

**Teste:**
```bash
cd finledger
npm install
npm run tauri dev
```
Uma janela desktop vazia deve abrir sem erros no terminal.

---

## TASK 02 — Configurar Tauri e instalar dependências

**O que fazer:**  
Adicionar o plugin SQLite e ajustar as configurações da janela no `tauri.conf.json`.

**Adicionar o plugin SQL ao Cargo.toml** (`src-tauri/Cargo.toml`):
```toml
[dependencies]
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

**Instalar o plugin no package.json:**
```bash
npm install @tauri-apps/plugin-sql
```

**Atualizar `tauri.conf.json`** com as configurações de janela:
```json
{
  "app": {
    "windows": [
      {
        "title": "Caixa",
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
      "preload": ["sqlite:caixa.db"]
    }
  }
}
```

**Teste:**  
`npm run tauri dev` continua abrindo sem erros após as mudanças.

---

## TASK 03 — Baixar assets externos

**O que fazer:**  
O protótipo carrega fontes e SheetJS de CDNs externos. No Tauri, tudo precisa ser local. Baixar e colocar em `src/assets/`.

**Fontes (DM Serif Display + DM Sans):**  
Acessar https://fonts.google.com, baixar as duas fontes e colocar os arquivos `.woff2` em `src/assets/fonts/`.  
Criar `src/assets/fonts/fonts.css` com as declarações `@font-face` apontando para os arquivos locais.

**SheetJS:**  
Baixar o arquivo em https://cdn.sheetjs.com/xlsx-0.18.5/package/dist/xlsx.full.min.js  
Salvar em `src/assets/xlsx.full.min.js`.

**Estrutura final:**
```
src/assets/
├── xlsx.full.min.js
└── fonts/
    ├── fonts.css
    ├── DMSerifDisplay-Regular.woff2
    ├── DMSerifDisplay-Italic.woff2
    └── DMSans-[300,400,500,600].woff2
```

**Teste:**  
Abrir `src/index.html` no browser e verificar se as fontes carregam corretamente sem internet.

---

## TASK 04 — Separar o protótipo em 3 arquivos

**O que fazer:**  
Pegar o `financas-pessoais.html` original (arquivo único com tudo inline) e separar em `index.html`, `styles.css` e `main.js` dentro de `src/`.

**Regras da separação:**
- `index.html` — apenas o HTML estrutural. Sem nenhuma linha de `<style>` ou `<script>` inline. Referenciar os arquivos externos:
  ```html
  <link rel="stylesheet" href="assets/fonts/fonts.css">
  <link rel="stylesheet" href="styles.css">
  <script src="assets/xlsx.full.min.js"></script>
  <script src="main.js" defer></script>
  ```
- `styles.css` — todo o conteúdo que estava dentro da tag `<style>` do protótipo
- `main.js` — todo o conteúdo que estava dentro da tag `<script>` do protótipo

**Nada muda funcionalmente nesta task** — o JS ainda usa IndexedDB. O objetivo é só reorganizar o código.

**Prompt sugerido para a IA:**
> "Tenho um arquivo HTML com CSS e JS inline. Preciso separar em três arquivos: index.html (só estrutura), styles.css (todo o CSS) e main.js (todo o JS). Nenhuma lógica deve mudar — é só reorganização. Aqui está o arquivo: [colar o HTML]"

**Teste:**  
Abrir `src/index.html` no browser. O app deve funcionar identicamente ao protótipo original, incluindo salvar dados via IndexedDB.

---

## TASK 05 — Criar schema SQLite e inicialização do banco

**O que fazer:**  
Criar os arquivos Rust responsáveis por inicializar o banco de dados, criar as tabelas e executar o seed de categorias.

**Arquivos a criar:**
- `src-tauri/src/db/mod.rs` — exporta os módulos
- `src-tauri/src/db/schema.rs` — cria as tabelas e executa o seed

**Schema SQL a implementar** (ver ARCHITECTURE.md seção 4.2):
```sql
CREATE TABLE IF NOT EXISTS categorias (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  TEXT NOT NULL,
  tipo  TEXT NOT NULL CHECK(tipo IN ('receita', 'despesa')),
  cor   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transacoes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao  TEXT NOT NULL,
  valor      REAL NOT NULL CHECK(valor > 0),
  data       TEXT NOT NULL,
  tipo       TEXT NOT NULL CHECK(tipo IN ('receita', 'despesa')),
  categoria  TEXT NOT NULL,
  obs        TEXT DEFAULT ''
);
```

**Seed de categorias** (ver SPEC.md seção 3):  
Se a tabela `categorias` estiver vazia ao iniciar, inserir as 11 categorias padrão.

**Prompt sugerido para a IA:**
> "Preciso criar os arquivos Rust para inicializar o banco SQLite no Tauri 2. Usando o plugin tauri-plugin-sql. O banco deve criar as tabelas e executar um seed se estiver vazio. Aqui está o schema e os dados do seed: [colar ARCHITECTURE.md seção 4 e SPEC.md seção 3]"

**Teste:**  
`npm run tauri dev` abre sem erros. O arquivo `caixa.db` é criado na pasta de dados do sistema. Verificar com um visualizador SQLite (ex: DB Browser for SQLite) que as tabelas existem e o seed foi inserido.

---

## TASK 06 — Implementar os commands Rust (CRUD)

**O que fazer:**  
Criar as funções Rust que serão expostas ao frontend via `invoke()`. São 6 commands no total — 3 para transações, 3 para categorias.

**Arquivos a criar:**
- `src-tauri/src/db/transacoes.rs` — get_all, save (upsert), delete
- `src-tauri/src/db/categorias.rs` — get_all, save (upsert), delete

**Commands a implementar** (ver ARCHITECTURE.md seção 5):

```
get_all_transacoes()      → Vec<Transacao>
save_transacao(transacao) → i64
delete_transacao(id)      → ()

get_all_categorias()      → Vec<Categoria>
save_categoria(categoria) → i64
delete_categoria(id)      → ()
```

**Lógica do save (upsert):**
- Se o objeto vier sem `id` (ou `id = 0`): executar INSERT, retornar o id gerado
- Se o objeto vier com `id`: executar UPDATE, retornar o mesmo id

**Prompt sugerido para a IA:**
> "Preciso implementar 6 Tauri commands em Rust para fazer CRUD no SQLite usando tauri-plugin-sql 2. Aqui está o contrato de cada command com os tipos esperados: [colar ARCHITECTURE.md seção 5]"

**Teste:**  
O projeto compila sem erros com `npm run tauri dev`.

---

## TASK 07 — Registrar os commands no Tauri

**O que fazer:**  
Conectar os commands criados na Task 06 ao sistema do Tauri para que o frontend possa chamá-los via `invoke()`.

**Arquivo a editar:** `src-tauri/src/lib.rs`

Os commands precisam ser registrados com `.invoke_handler(tauri::generate_handler![...])` e o plugin SQL precisa ser inicializado com `.plugin(tauri_plugin_sql::Builder::default().build())`.

**Prompt sugerido para a IA:**
> "Preciso registrar estes commands Tauri no lib.rs e inicializar o plugin SQL. Aqui estão os nomes dos commands: get_all_transacoes, save_transacao, delete_transacao, get_all_categorias, save_categoria, delete_categoria"

**Teste:**  
`npm run tauri dev` compila e abre sem erros.

---

## TASK 08 — Migrar o frontend: substituir IndexedDB por invoke()

**O que fazer:**  
Esta é a mudança principal no `main.js`. Remover todo o código do IndexedDB e substituir cada chamada pelo `invoke()` equivalente.

**O que remover do main.js:**
- Variável `let db`
- Função `initDB()`
- Função `dbGetAll()`
- Função `dbPut()`
- Função `dbDelete()`

**Tabela de substituição** (ver ARCHITECTURE.md seção 6):

| Remover | Substituir por |
|---|---|
| `await dbGetAll('transacoes')` | `await invoke('get_all_transacoes')` |
| `await dbGetAll('categorias')` | `await invoke('get_all_categorias')` |
| `await dbPut('transacoes', obj)` | `await invoke('save_transacao', { transacao: obj })` |
| `await dbPut('categorias', obj)` | `await invoke('save_categoria', { categoria: obj })` |
| `await dbDelete('transacoes', id)` | `await invoke('delete_transacao', { id })` |
| `await dbDelete('categorias', id)` | `await invoke('delete_categoria', { id })` |

**Adicionar o import do invoke no topo do main.js:**
```javascript
const { invoke } = window.__TAURI__.core;
```

**Atualizar a função `init()`:**  
Remover a chamada `await initDB()`. O banco já é inicializado pelo Rust na Task 05.

**Nenhuma outra lógica muda** — renderização, filtros, formatação de datas e moeda, navegação, tudo permanece igual.

**Prompt sugerido para a IA:**
> "Preciso migrar este main.js do IndexedDB para os invoke() do Tauri 2. A única mudança é substituir as chamadas de banco — toda a lógica de renderização permanece igual. Aqui está a tabela de migração: [colar ARCHITECTURE.md seção 6]. Aqui está o main.js atual: [colar main.js]"

**Teste:**  
`npm run tauri dev`. Testar cada operação manualmente:
- [ ] Dashboard carrega com os cards zerados
- [ ] Criar uma transação de receita e uma de despesa
- [ ] Os cards do dashboard atualizam corretamente
- [ ] Editar uma transação existente
- [ ] Excluir uma transação
- [ ] Criar uma categoria nova
- [ ] Editar uma categoria
- [ ] Excluir uma categoria
- [ ] Fechar e reabrir o app — os dados persistem

---

## TASK 09 — Testar o app completo

**O que fazer:**  
Percorrer todas as funcionalidades da Spec e confirmar paridade com o protótipo HTML original.

**Checklist por tela:**

**Dashboard:**
- [ ] Navegador de mês (seta esquerda / direita) atualiza os 4 cards
- [ ] Card Receitas mostra só as receitas do mês selecionado
- [ ] Card Despesas mostra só as despesas do mês selecionado
- [ ] Card Saldo do mês = Receitas − Despesas
- [ ] Card Saldo acumulado = soma de todas as transações de todos os meses
- [ ] Gastos por categoria lista corretamente com barras de progresso
- [ ] Estado vazio "Sem gastos neste mês" aparece quando não há despesas
- [ ] Últimas 6 transações não muda ao trocar o mês
- [ ] Gráfico de barras exibe os 6 meses corretos

**Transações:**
- [ ] Filtro de mês funciona
- [ ] Filtro de tipo funciona
- [ ] Filtro de categoria funciona
- [ ] Busca por descrição funciona (case-insensitive)
- [ ] Combinação de filtros funciona
- [ ] Linha de totais mostra os valores corretos do conjunto filtrado
- [ ] Contador "X transações" está correto
- [ ] Estado vazio aparece quando nenhum resultado
- [ ] Botão editar abre o formulário preenchido
- [ ] Botão excluir pede confirmação antes de deletar

**Nova / Editar Transação:**
- [ ] Tab Despesa / Receita muda o select de categorias
- [ ] Data padrão é hoje
- [ ] Validações disparam toast de erro correto
- [ ] Salvar redireciona para Transações
- [ ] Toast "Transação salva!" aparece
- [ ] Cancelar volta para Transações sem salvar

**Categorias:**
- [ ] Lista separada em Despesas e Receitas
- [ ] Modal abre para nova categoria
- [ ] Seletor de 12 cores funciona
- [ ] Editar categoria abre o modal preenchido
- [ ] Excluir categoria pede confirmação
- [ ] Fechar modal com Escape e com clique no overlay

**Importar Planilha:**
- [ ] Dropzone aceita clique e drag & drop
- [ ] Prévia mostra até 10 linhas
- [ ] "Importar tudo" insere as transações e redireciona
- [ ] Categorias inexistentes são criadas automaticamente
- [ ] Erros de formato exibem toast correto

**Persistência:**
- [ ] Fechar e reabrir o app — todos os dados continuam

---

## TASK 10 — Gerar o build final

**O que fazer:**  
Compilar o app para o executável instalável do sistema operacional.

**Comando:**
```bash
npm run tauri build
```

**Resultado esperado:**
- Windows: instalador `.msi` ou `.exe` em `src-tauri/target/release/bundle/`
- macOS: `.dmg` ou `.app`
- Linux: `.deb` ou `.AppImage`

**Teste:**  
Instalar o executável gerado e verificar que o app abre e funciona normalmente fora do ambiente de desenvolvimento.
