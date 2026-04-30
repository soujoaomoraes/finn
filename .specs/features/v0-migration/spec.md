# SPEC.md — FinLedger: Finanças Pessoais
**Versão:** V0 (paridade funcional com o protótipo HTML)  
**Plataforma:** Desktop — Tauri (Windows / macOS / Linux)  
**Última atualização:** Abril 2026

---

## 1. Visão Geral

**FinLedger** é um app desktop de finanças pessoais. O objetivo é permitir que o usuário registre receitas e despesas, visualize seu saldo mensal e histórico, organize gastos por categorias e importe dados de planilhas externas.

A V0 é uma paridade funcional do protótipo HTML existente. Nenhuma funcionalidade nova é adicionada nesta versão — o objetivo é apenas migrar para Tauri com persistência em SQLite no lugar do IndexedDB do navegador.

**Fora do escopo da V0:**
- Sincronização com nuvem
- Contas bancárias múltiplas
- Metas e orçamentos
- Notificações
- Relatórios avançados / gráficos de pizza
- Recorrência automática de transações
- Autenticação / múltiplos usuários

---

## 2. Entidades de Dados

### 2.1 Transação
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | INTEGER | sim (PK, auto) | Identificador único |
| descricao | TEXT | sim | Descrição da transação |
| valor | REAL | sim | Valor positivo (ex: 250.00) |
| data | TEXT | sim | Formato ISO: YYYY-MM-DD |
| tipo | TEXT | sim | `"receita"` ou `"despesa"` |
| categoria | TEXT | sim | Nome da categoria vinculada |
| obs | TEXT | não | Observação livre (pode ser vazio) |

**Regras:**
- `valor` deve ser maior que zero
- `tipo` aceita apenas `"receita"` ou `"despesa"`
- `data` deve ser uma data válida
- `descricao` não pode ser vazia

### 2.2 Categoria
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | INTEGER | sim (PK, auto) | Identificador único |
| nome | TEXT | sim | Nome da categoria (ex: "Alimentação") |
| tipo | TEXT | sim | `"receita"` ou `"despesa"` |
| cor | TEXT | sim | Cor em hex (ex: `#fb923c`) |

**Regras:**
- `nome` não pode ser vazio
- `cor` deve ser uma das 12 cores predefinidas do sistema

---

## 3. Dados Iniciais (Seed)

Ao abrir o app pela primeira vez (banco vazio), as seguintes categorias são criadas automaticamente:

**Despesas:**
| Nome | Cor |
|---|---|
| Alimentação | #fb923c |
| Transporte | #60a5fa |
| Moradia | #818cf8 |
| Saúde | #f472b6 |
| Lazer | #4ade80 |
| Educação | #22d3ee |
| Outros | #94a3b8 |

**Receitas:**
| Nome | Cor |
|---|---|
| Salário | #4ade80 |
| Freelance | #34d399 |
| Investimentos | #fbbf24 |
| Outros | #94a3b8 |

---

## 4. Paleta de Cores de Categoria

O sistema oferece exatamente 12 cores para seleção:

```
#f87171  #fb923c  #fbbf24  #a3e635
#4ade80  #34d399  #22d3ee  #60a5fa
#818cf8  #c084fc  #f472b6  #94a3b8
```

---

## 5. Layout e Navegação

O app usa um layout de **sidebar fixa à esquerda (220px)** + **área de conteúdo principal** à direita.

### 5.1 Sidebar
- Logo "FinLedger" + subtítulo "finanças pessoais"
- Seção **Visão Geral:** Dashboard
- Seção **Lançamentos:** Transações, Nova Transação
- Seção **Configurações:** Categorias, Importar Planilha
- Item ativo destacado visualmente

### 5.2 Navegação
Clicar em qualquer item da sidebar troca a seção visível. Apenas uma seção é exibida por vez. Ao salvar uma transação ou importar dados, o app redireciona automaticamente para Transações.

---

## 6. Telas

### 6.1 Dashboard

**Header:** título "Dashboard" + subtítulo "Resumo financeiro mensal" + navegador de mês (seta esquerda / label "Mês Ano" / seta direita)

**Cards de resumo (4 cards em linha):**
| Card | Conteúdo | Cor do valor |
|---|---|---|
| Receitas | Total de receitas do mês selecionado | Verde |
| Despesas | Total de despesas do mês selecionado | Vermelho |
| Saldo do mês | Receitas − Despesas do mês | Âmbar |
| Saldo acumulado | Soma de todas as transações (todos os meses) | Azul |

**Grid 2 colunas:**
- **Gastos por categoria:** lista as categorias de despesa do mês, ordenadas por valor decrescente. Cada item mostra: ponto colorido, nome da categoria, valor formatado, percentual sobre o total de despesas, barra de progresso proporcional. Se não houver gastos: estado vazio "Sem gastos neste mês".
- **Últimas 6 transações:** lista as 6 transações mais recentes de todos os meses (não apenas do mês selecionado), ordenadas por data decrescente. Cada item mostra: ponto colorido da categoria, descrição, data + categoria, valor com sinal (+ verde para receita, − vermelho para despesa). Se não houver transações: estado vazio.

**Gráfico de evolução mensal:**
- Exibe os últimos 6 meses a partir do mês selecionado
- Gráfico de barras lado a lado: barra verde (receitas) + barra vermelha (despesas) por mês
- Legenda: "Receitas" e "Despesas"
- Eixo Y implícito: altura proporcional ao maior valor entre todos os meses

**Interação:** navegador de mês atualiza os 4 cards e o gráfico em tempo real. A lista de últimas transações não muda com o mês (sempre as 6 mais recentes).

---

### 6.2 Transações

**Header:** título "Transações" + botão "Nova transação" (redireciona para Nova Transação)

**Barra de filtros:**
| Filtro | Tipo | Comportamento |
|---|---|---|
| Mês | Select | Opções geradas dinamicamente a partir dos anos/meses com transações + "Todos". Padrão: mês atual |
| Tipo | Select | "Todos", "Receita", "Despesa". Padrão: Todos |
| Categoria | Select | "Todas" + lista de categorias. Padrão: Todas |
| Busca | Input texto | Filtra por descrição (case-insensitive, substring) |

Todos os filtros são combinados (AND). A lista atualiza em tempo real ao mudar qualquer filtro.

**Tabela:**
Colunas: Data | Descrição | Categoria | Tipo | Valor | Ações

- Data: formato DD/MM/YYYY, cor secundária
- Descrição: texto principal + observação abaixo em fonte menor (se existir)
- Categoria: ponto colorido + nome
- Tipo: badge "receita" (verde) ou "despesa" (vermelho)
- Valor: alinhado à direita, "+R$ X" verde para receita / "−R$ X" vermelho para despesa
- Ações: botão editar (abre tela Nova Transação em modo edição) + botão excluir (confirmação antes de excluir)

**Linha de totais** ao final da tabela: mostra total de receitas e total de despesas do conjunto filtrado.

**Contador:** "X transações" acima ou abaixo da tabela.

**Estado vazio:** ícone + "Nenhuma transação encontrada" quando nenhuma transação corresponde aos filtros.

---

### 6.3 Nova Transação / Editar Transação

**Header:** título "Nova Transação" ou "Editar Transação" + subtítulo "Organize seus lançamentos"

**Formulário:**

| Campo | Componente | Validação |
|---|---|---|
| Tipo | Tabs "Despesa" / "Receita" | Obrigatório. Padrão: Despesa |
| Descrição | Input texto | Obrigatório, não pode ser vazio |
| Valor | Input numérico com prefixo "R$" | Obrigatório, > 0 |
| Data | Input date | Obrigatório. Padrão: data de hoje |
| Categoria | Select | Obrigatório. Filtra pelo tipo selecionado |
| Observação | Textarea | Opcional |

**Comportamento do select de categoria:** ao mudar o tipo (Despesa/Receita), o select de categoria é recarregado com apenas as categorias do tipo correspondente.

**Botões:** "Salvar" + "Cancelar" (volta para Transações sem salvar)

**Ao salvar com sucesso:**
- Toast "Transação salva!" ou "Transação atualizada!"
- Redireciona para Transações
- O mês selecionado no dashboard/filtros é atualizado para o mês da transação salva

**Validações com toast de erro:**
- "Informe a descrição"
- "Informe um valor válido"
- "Informe a data"

---

### 6.4 Categorias

**Header:** título "Categorias" + subtítulo + botão "Nova categoria" (abre modal)

**Layout 2 colunas:** coluna Despesas | coluna Receitas

Cada coluna lista as categorias do tipo com:
- Ponto colorido
- Nome
- Botão editar (abre modal preenchido)
- Botão excluir (confirmação)

**Estado vazio por coluna:** "Nenhuma categoria" quando a lista está vazia.

**Modal Nova / Editar Categoria:**
- Título: "Nova Categoria" ou "Editar Categoria"
- Campo Nome (obrigatório)
- Select Tipo: "Despesa" / "Receita"
- Seletor de cor: 12 swatches coloridos, um selecionado por vez (borda branca + leve escala ao selecionar)
- Botões: "Salvar" + "Cancelar"
- Validação: toast "Informe o nome" se vazio
- Fechar com clique no overlay ou tecla Escape

---

### 6.5 Importar Planilha

**Header:** título "Importar Planilha" + subtítulo

**Dropzone:**
- Área clicável para selecionar arquivo
- Aceita drag & drop
- Formatos aceitos: `.xlsx`, `.xls`, `.csv`
- Visual muda ao arrastar arquivo sobre a área

**Formato esperado da planilha:**

| Data | Descrição | Valor | Tipo | Categoria |
|---|---|---|---|---|
| 15/01/2025 | Supermercado | 250.00 | despesa | Alimentação |
| 01/01/2025 | Salário | 3500.00 | receita | Trabalho |

- Colunas detectadas por nome (case-insensitive, substring): "data", "descri", "valor", "tipo", "cat"
- Coluna "Tipo" se ausente: assume "despesa"
- Coluna "Categoria" se ausente: assume "Outros"
- Datas aceitas: DD/MM/YYYY, YYYY-MM-DD, serial numérico do Excel

**Prévia antes de confirmar:**
- Tabela com até 10 linhas (colunas: Data, Descrição, Valor, Tipo, Categoria)
- Se houver mais de 10 linhas: "...e mais X linhas. Total: Y transações."
- Botões: "Importar tudo" + "Cancelar"

**Ao confirmar importação:**
- Categorias inexistentes são criadas automaticamente com cor aleatória da paleta
- Toast "X transações importadas!"
- Redireciona para Transações

**Erros tratados com toast:**
- "Planilha vazia ou sem dados"
- "Colunas não encontradas. Verifique o formato."
- "Nenhuma linha válida encontrada"
- "Erro ao ler arquivo: [mensagem]"

---

## 7. Componentes Globais

### 7.1 Toast de Notificação
- Aparece no canto inferior direito
- Desaparece automaticamente após 2,8 segundos
- Animação: desliza de baixo para cima ao aparecer
- Usado para: confirmações de sucesso, erros de validação, erros de leitura

### 7.2 Formatação de Valores
- Moeda: `R$ X.XXX,XX` (formato pt-BR com `toLocaleString`)
- Datas exibidas: DD/MM/YYYY
- Datas armazenadas internamente: YYYY-MM-DD

### 7.3 Estados Vazios
Todas as listas e tabelas exibem um estado vazio com ícone e mensagem quando não há dados.

---

## 8. Comportamento de Persistência (Tauri/SQLite)

Na versão HTML o armazenamento era feito via IndexedDB no browser. Na versão Tauri, toda persistência é feita em um arquivo SQLite local na máquina do usuário.

**Operações necessárias (mapeiam para Tauri commands):**
- `get_all_transacoes` → retorna todas as transações
- `get_all_categorias` → retorna todas as categorias
- `save_transacao(obj)` → insere ou atualiza (upsert por id)
- `delete_transacao(id)` → remove por id
- `save_categoria(obj)` → insere ou atualiza
- `delete_categoria(id)` → remove por id

O frontend chama esses commands via `invoke()` do Tauri em todos os lugares onde o HTML original chamava as funções `dbPut`, `dbGetAll` e `dbDelete` do IndexedDB.

---

## 9. Design Visual

**Tema:** Dark exclusivo (sem toggle light/dark na V0)

**Cores principais:**
```
--bg:      #0f0f0f   (fundo geral)
--bg2:     #181818   (sidebar, cards)
--bg3:     #222222   (inputs, hover)
--border:  #2e2e2e
--text:    #f0ece4
--text2:   #9a9490
--text3:   #5a5650
--green:   #4ade80
--red:     #f87171
--amber:   #fbbf24
--blue:    #60a5fa
--accent:  #c8b89a   (botão primário, logo)
```

**Tipografia:**
- Títulos / valores grandes: DM Serif Display
- Corpo / labels / botões: DM Sans (300, 400, 500, 600)
- Tamanho base: 14px

**Border radius:** 10px (cards), 6px (inputs, botões)
