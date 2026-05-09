# TASK.md — FinLedger V0.5
**Versão:** V0.5 — Fundação Técnica + Redesign Visual
**Stack:** Vite + Vanilla JS
**Última atualização:** Abril 2026

---

## Fase 0 — Setup Vite

- [x] Instalar Vite: `npm install -D vite`
- [x] Criar `vite.config.js` na raiz com config padrão Tauri (porta 1420, target chrome105)
- [x] Mover `index.html` para a raiz do projeto (Vite exige na raiz, não em `src/`)
- [x] Atualizar `tauri.conf.json`: `devUrl` para `http://localhost:1420`, `beforeDevCommand` para `npm run dev`, `frontendDist` para `../dist`
- [x] Adicionar scripts no `package.json`: `"dev": "vite"`, `"build": "vite build"`
- [x] Testar `npm run tauri dev` — janela deve abrir com HMR funcionando
- [x] Confirmar que hot reload funciona: alterar uma cor no CSS e ver refletir sem rebuild

---

## Fase 1 — Refatoração Modular

- [x] Criar `src/db.js` e mover todos os `invoke()` do app para ele
- [x] Criar `src/utils.js` com funções de formatação de moeda e data
- [x] Criar `src/toast.js` com lógica de exibição e auto-dismiss do toast
- [x] Criar `src/router.js` com lógica de navegação entre telas
- [x] Extrair `src/components/sidebar.js` — renderização e estado ativo da sidebar
- [x] Extrair `src/screens/dashboard.js` + `dashboard.css`
- [x] Extrair `src/screens/transacoes.js` + `transacoes.css`
- [x] Extrair `src/screens/categorias.js` + `categorias.css`
- [x] Extrair `src/screens/importar.js` + `importar.css`
- [x] Atualizar `src/main.js` para importar e inicializar todos os módulos via ES Modules
- [x] Verificar que nenhum arquivo JS ultrapassa ~300 linhas
- [x] Smoke test: todas as funcionalidades da V0 funcionando sem regressão

---

## Fase 2 — Identidade e Paleta

- [x] Adicionar Google Fonts: Syne (600, 700) e Instrument Sans (400, 500, 600) no `index.html`
- [x] Atualizar variáveis CSS com nova paleta completa (fundos, textos, acento laranja, semânticas)
- [x] Aplicar Syne nos valores grandes dos cards e títulos de tela
- [x] Aplicar Instrument Sans em todo o corpo, labels, botões e formulários
- [x] Substituir `--accent: #c8b89a` por `--accent: #f97316` em toda a base de estilos
- [x] Atualizar border-radius dos cards de 10px para 16px
- [x] Remover bordas pesadas — separação de cards apenas por cor de fundo
- [x] Atualizar inputs: background `--bg3`, focus com border `--accent`
- [x] Atualizar botão primário: background `--accent`, texto escuro, hover `--accent2`
- [x] Atualizar badges de receita/despesa com backgrounds semânticos (`--green-bg`, `--red-bg`)

---

## Fase 3 — Sidebar e Identidade FinLedger

- [] Substituir "Caixa" por "FinLedger" no logo da sidebar (Syne 700, cor `--accent`)
- [] Atualizar subtítulo "finanças pessoais" (Instrument Sans 400, 11px, `--text3`)
- [] Atualizar título da janela Tauri para "FinLedger" no `tauri.conf.json`
- [] Aplicar novo estilo nos itens da sidebar: item ativo com borda esquerda `2px solid --accent`
- [] Estilizar labels de seção da sidebar (uppercase, 11px, letter-spacing 0.1em, `--text3`)
- [] Buscar e substituir qualquer outra referência textual a "Caixa" no código

---

## Fase 4 — Drawer de Transação

- [] Criar `src/components/drawer.js` — estrutura HTML e lógica do drawer
- [] Criar `src/components/drawer.css` — estilos e animações do drawer
- [] Implementar animação de abertura: slide da direita, `250ms ease-out`
- [] Implementar overlay com `backdrop-filter: blur(4px)` e fade-in
- [] Mover conteúdo do formulário de Nova/Editar Transação para dentro do drawer
- [] Fechar drawer ao clicar no overlay
- [] Fechar drawer ao pressionar `Escape`
- [] Fechar drawer e atualizar lista ao salvar com sucesso
- [] Remover tela dedicada de Nova Transação da navegação e do router
- [] Atualizar item "Nova Transação" na sidebar para abrir drawer
- [] Atualizar botão "Nova transação" na tela de Transações para abrir drawer
- [] Atualizar botão "Editar" na tabela para abrir drawer com dados preenchidos

---

## Fase 5 — Polimento Visual

- [] Aplicar micro-transições de hover em todos os elementos interativos (`150ms ease`)
- [] Animação de preenchimento nas barras de progresso do Dashboard (`600ms ease-out`)
- [] Revisar animação do toast: slide-up + fade-in, `200ms ease-out`
- [] Revisar swatch de cor no modal de categoria: hover `scale(1.1)`, selecionado com borda branca
- [] Revisar espaçamentos em todas as telas (padding, gap, margens)
- [] Verificar consistência visual entre todas as telas (nenhuma tela com estilo diferente)
- [] Teste final completo: criar, editar, excluir transação, categoria, importar planilha