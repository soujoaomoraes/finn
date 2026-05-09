# SPEC.md — FinLedger V0.5
**Versão:** V0.5 — Fundação Técnica + Redesign Visual
**Plataforma:** Desktop — Tauri (Windows / macOS / Linux)
**Stack frontend:** Vite + Vanilla JS (ES Modules)
**Última atualização:** Abril 2026

---

## 1. Visão Geral

A V0.5 não adiciona novas funcionalidades. O objetivo é duplo:

1. **Técnico:** Refatorar o código JS monolítico em módulos organizados, estabelecendo uma arquitetura que permita desenvolvimento com IA de forma confiável e sem risco de regressão.

2. **Visual:** Dar ao FinLedger uma identidade própria — abandonar a aparência genérica e criar um app que as pessoas achem bonito de usar.

Toda funcionalidade existente da V0 deve continuar funcionando exatamente igual após a V0.5.

---

## 2. Stack Frontend

### 2.1 Por que Vite

O projeto migra de HTML/JS servido diretamente pelo Tauri para **Vite como dev server e bundler**. Isso resolve dois problemas práticos:

- **Hot Module Replacement (HMR):** salvar um arquivo reflete instantaneamente na janela do Tauri sem rebuild. Essencial para a fase de redesign visual onde ajustes de CSS são frequentes
- **ES Modules nativos:** o `import/export` entre módulos funciona naturalmente durante o dev, sem hacks de script tags ou bundling manual

O Vite é transparente em produção — o `tauri build` continua funcionando exatamente igual, o Vite apenas empacota os assets antes.

### 2.2 Configuração

```
finledger/
├── src/                     # Frontend (Vite root)
│   ├── index.html           # Entry HTML — único arquivo HTML
│   ├── main.js              # Entry JS — importa e inicializa tudo
│   └── ...                  # Módulos JS e CSS
├── src-tauri/               # Backend Rust (inalterado)
├── vite.config.js           # Config Vite + plugin Tauri
└── package.json
```

**`vite.config.js` mínimo:**
```js
import { defineConfig } from 'vite'

export default defineConfig({
  clearScreen: false,
  server: {
    strictPort: true,
    port: 1420,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'chrome105',
    minify: !process.env.TAURI_DEBUG,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
```

**`tauri.conf.json` — ajuste necessário:**
```json
"build": {
  "beforeDevCommand": "npm run dev",
  "beforeBuildCommand": "npm run build",
  "devUrl": "http://localhost:1420",
  "frontendDist": "../dist"
}
```

### 2.3 Scripts npm

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "tauri": "tauri"
}
```

Desenvolvimento: `npm run tauri dev` — inicia Vite + Tauri juntos com HMR ativo.

---

## 3. Refatoração Modular

### 3.1 Problema atual

O frontend está implementado em um único arquivo JS grande (monolítico). Isso causa:
- Dificuldade de edição com IA (perda de contexto, risco de sobrescrever código não relacionado)
- Impossibilidade de trabalhar em uma tela sem risco de quebrar outra
- Ausência de separação de responsabilidades

### 3.2 Estrutura de módulos alvo

```
src/
├── main.js                  # Entry point — inicializa o app, registra rotas/navegação
├── db.js                    # Camada de dados — todos os invoke() do Tauri centralizados aqui
├── utils.js                 # Formatação de moeda, datas, helpers genéricos
├── toast.js                 # Sistema de toast (show, hide, tipos)
├── router.js                # Lógica de navegação entre telas
│
├── components/
│   ├── sidebar.js           # Renderização e lógica da sidebar
│   └── drawer.js            # Drawer lateral de Nova/Editar Transação
│
└── screens/
    ├── dashboard.js         # Tela Dashboard
    ├── transacoes.js        # Tela Transações (listagem + filtros)
    ├── categorias.js        # Tela Categorias + modal
    └── importar.js          # Tela Importar Planilha
```

### 3.3 Convenções

- Cada módulo usa `export` explícito — sem poluição de escopo global
- `db.js` é a única camada que chama `invoke()` — nenhuma tela chama invoke diretamente
- CSS de cada tela em arquivo separado (`screens/dashboard.css`, etc.) — Vite importa via `import './dashboard.css'` no topo do módulo
- Eventos entre módulos via callbacks ou eventos customizados do DOM
- Nenhuma lógica de negócio dentro de handlers de UI (separar "o que fazer" de "como exibir")

---

## 4. Redesign Visual

### 4.1 Direção estética

**Referências:** Pierre app, Robinhood, C6 Bank, Banco Inter
**Tom:** Dark refinado — não é dark pesado. Preto quente, não frio. Números são protagonistas. Uma cor de acento usada cirurgicamente.
**Princípio:** Menos elementos, mais presença. Cada coisa na tela tem um motivo de estar lá.

### 4.2 Paleta de cores

```css
/* Fundos */
--bg:        #0a0a0a   /* fundo geral — quase preto, levemente quente */
--bg2:       #111111   /* sidebar, cards */
--bg3:       #1a1a1a   /* inputs, hover, drawer */
--bg4:       #222222   /* hover em cima de bg3, bordas internas */

/* Bordas */
--border:    #2a2a2a
--border2:   #333333   /* bordas de foco, separadores mais visíveis */

/* Texto */
--text:      #f5f0e8   /* texto principal — branco levemente quente */
--text2:     #8a8480   /* texto secundário */
--text3:     #4a4540   /* texto desabilitado, placeholders */

/* Acento de marca — laranja/âmbar */
--accent:    #f97316   /* laranja principal — botões primários, destaques */
--accent2:   #fb923c   /* laranja claro — hover, variações */
--accent3:   #7c3100   /* laranja escuro — backgrounds de acento sutil */

/* Semânticas — apenas para dados financeiros */
--green:     #4ade80   /* receitas */
--green-bg:  #052e16   /* background de badge receita */
--red:       #f87171   /* despesas */
--red-bg:    #2d0a0a   /* background de badge despesa */
--amber:     #fbbf24   /* saldo do mês */
--blue:      #60a5fa   /* saldo acumulado */
```

> As cores semânticas (verde, vermelho, âmbar, azul) existem exclusivamente para representar dados financeiros. O laranja é a cor de identidade do app — botões, links, destaques de navegação, logo.

### 4.3 Tipografia

```css
/* Display — valores grandes, títulos de seção */
font-family: 'Syne', sans-serif;
/* Pesos usados: 700 (valores monetários grandes), 600 (títulos) */

/* Corpo — labels, textos, botões, formulários */
font-family: 'Instrument Sans', sans-serif;
/* Pesos usados: 400 (corpo), 500 (labels, botões), 600 (destaques) */
```

**Carregamento:** Google Fonts via `@import` no CSS principal.

**Hierarquia de tamanhos:**
| Uso | Fonte | Tamanho | Peso |
|---|---|---|---|
| Valores grandes (cards) | Syne | 28–32px | 700 |
| Títulos de tela | Syne | 22px | 600 |
| Títulos de seção | Instrument Sans | 13px uppercase + letter-spacing 0.08em | 500 |
| Corpo | Instrument Sans | 14px | 400 |
| Labels / badges | Instrument Sans | 12px | 500 |
| Texto secundário | Instrument Sans | 13px | 400 |

### 4.4 Componentes visuais

**Cards:**
- Background: `--bg2`
- Border: `1px solid --border`
- Border-radius: `16px`
- Padding: `24px`
- Sem sombra pesada — separação por cor de fundo

**Inputs e selects:**
- Background: `--bg3`
- Border: `1px solid --border`
- Border-radius: `8px`
- Padding: `10px 14px`
- Focus: border `--accent`, outline none
- Placeholder: `--text3`

**Botão primário:**
- Background: `--accent`
- Cor: `#0a0a0a` (texto escuro sobre laranja)
- Border-radius: `8px`
- Padding: `10px 20px`
- Font: Instrument Sans 500 14px
- Hover: background `--accent2`, leve escala `scale(1.01)`
- Transição: `150ms ease`

**Botão secundário / ghost:**
- Background: transparente
- Border: `1px solid --border2`
- Cor: `--text2`
- Hover: background `--bg3`, cor `--text`

**Badges de tipo:**
- Receita: cor `--green`, background `--green-bg`, border-radius `6px`, padding `3px 8px`
- Despesa: cor `--red`, background `--red-bg`

**Sidebar:**
- Background: `--bg2`
- Largura: `220px`, fixa
- Item ativo: background `--bg3`, borda esquerda `2px solid --accent`, cor `--text`
- Item inativo: cor `--text2`, hover background `--bg3` suave
- Labels de seção (VISÃO GERAL, LANÇAMENTOS, etc.): `--text3`, uppercase, 11px, letter-spacing 0.1em

**Logo na sidebar:**
- "FinLedger" em Syne 700, cor `--accent`
- Subtítulo "finanças pessoais" em Instrument Sans 400 11px, cor `--text3`

### 4.5 Micro-interações

- Transições de hover em todos os elementos interativos: `150ms ease`
- Toast: slide-up de 8px com fade-in, `200ms ease-out`
- Drawer: slide da direita, `250ms ease-out`, overlay com `backdrop-filter: blur(4px)`
- Swatches de cor (modal de categoria): `scale(1.1)` no hover, borda branca no selecionado
- Barras de progresso (gastos por categoria): animação de preenchimento ao renderizar, `600ms ease-out`

---

## 5. Mudança de UX: Drawer de Transação

### 5.1 Comportamento

O formulário de Nova Transação e Editar Transação deixa de ser uma tela separada e passa a ser um **drawer lateral** que desliza da direita.

- Abre ao clicar em "Nova transação" (em qualquer tela) ou no botão de editar na lista
- Ocupa ~480px de largura, altura 100% da janela
- Overlay escurecido à esquerda (`rgba(0,0,0,0.6)` + blur sutil)
- Fecha ao: clicar no overlay, pressionar `Escape`, ou após salvar com sucesso
- O conteúdo da tela ao fundo permanece visível e não some

### 5.2 Conteúdo do drawer

Idêntico ao formulário atual da tela Nova Transação. Nenhum campo é removido ou adicionado.

### 5.3 Impacto na navegação

- O item "Nova Transação" na sidebar continua existindo e abre o drawer sobre a tela atual
- A tela dedicada `/nova-transacao` é removida
- O botão "Editar" na tabela de transações abre o drawer com os dados preenchidos
- Após salvar: drawer fecha, toast aparece, lista de transações atualiza sem recarregar a tela

---

## 6. Identidade: Renomear "Caixa" para "FinLedger"

- Sidebar: logo passa a exibir "FinLedger" (Syne 700, `--accent`)
- Título da janela Tauri: "FinLedger"
- Qualquer outra referência textual a "Caixa" no código é substituída

---

## 7. O que NÃO muda na V0.5

- Funcionalidades: zero mudanças em regras de negócio
- Entidades de dados: schema SQLite permanece idêntico
- Tauri commands: nenhum command novo ou alterado
- Telas existentes: Dashboard, Transações, Categorias, Importar — todas mantidas com mesma lógica
- Dados de seed e paleta de cores de categoria: inalterados

---

## 8. Critérios de conclusão

- [ ] Nenhum arquivo JS tem mais de ~300 linhas
- [ ] `db.js` centraliza todos os `invoke()` — nenhuma tela chama invoke diretamente
- [ ] Todas as funcionalidades da V0 funcionam sem regressão
- [ ] "Caixa" não aparece em nenhum lugar visível ao usuário
- [ ] Drawer abre e fecha com animação, salva e fecha corretamente
- [ ] Nova paleta e tipografia aplicadas em todas as telas
- [ ] App visualmente consistente — nenhuma tela com estilo diferente das outras