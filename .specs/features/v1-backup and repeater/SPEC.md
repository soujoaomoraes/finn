# SPEC.md — FinLedger V1
**Versão:** V1 — Backup + Recorrentes
**Plataforma:** Desktop — Tauri (Windows / macOS / Linux)
**Última atualização:** Maio 2026

---

## 1. Visão Geral

A V1 adiciona três funcionalidades que aumentam o valor prático do app no uso diário:

1. **Backup no Google Drive:** sincronização automática e silenciosa após conectar uma vez.
2. **Exportar / Importar dados:** a tela de importação evolui para suportar também exportação de CSV por período.
3. **Recorrentes:** transações que se repetem no tempo e são geradas automaticamente.

Todas são **opcionais e não destrutivas** — quem não conectar o Drive ou não cadastrar recorrentes não vê nenhuma mudança no fluxo existente.

---

## 2. Fora do Escopo da V1

- Backup local manual em JSON
- Histórico de versões de backup (o Drive já oferece isso nativamente)
- Sincronização em tempo real entre dispositivos
- Recorrências com fim de prazo (ex: "repetir por 12 meses")
- Recorrências com valor variável
- Notificações do sistema operacional para recorrentes vencidas

---

## 3. Backup no Google Drive

### 3.1 Visão geral

**Decisões V1 atualizadas:**
- O app continua offline-first: SQLite local é a fonte da verdade.
- Google Drive atua apenas como backup/sync assíncrono, nunca como armazenamento primário.
- A implementação real do backup usa o OAuth Client ID de desktop já criado no Google Cloud.
- OAuth Client ID inicial: `281581841973-detiallepdbf11dvdpj8d4tk86iu43tl.apps.googleusercontent.com`
- O backup da V1 inicial inclui `transacoes` e `categorias`; recorrentes ficam fora do arquivo de backup por enquanto.

O backup é exclusivamente via Google Drive. Não há backup local em JSON — a exportação de dados do usuário é feita pela tela de Importar / Exportar (seção 4).

O modelo é **arquivo único sobrescrito**: o app mantém um único arquivo `finledger-backup.json` na pasta privada do app no Drive, sobrescrito a cada sync. O histórico de versões fica a cargo do próprio Google Drive (que mantém versões anteriores automaticamente), sem nenhuma gestão extra pelo app.

---

### 3.2 Autenticação

- Botão "Conectar com Google" na tela de Backup
- Abre o fluxo OAuth do Google no navegador padrão do sistema (via Tauri `shell` plugin)
- Usa OAuth 2.0 com PKCE e OAuth Client ID de desktop
- Escopo solicitado: apenas `appDataFolder` — pasta oculta e privada do app no Drive, invisível ao usuário no Drive normal, sem acesso aos arquivos pessoais dele
- Após autorização: token armazenado localmente na pasta de dados do app (nunca exposto na UI)
- Estado conectado: exibe e-mail da conta + data/hora do último sync
- Botão "Desconectar": revoga o token localmente e para a sincronização (não apaga o arquivo do Drive)

---

### 3.3 Sincronização automática

**Arquitetura de sync V1:**
- Toda alteração salva primeiro no SQLite local.
- Depois do save local, o estado de backup é marcado como `dirty`.
- Um debounce agrupa alterações próximas antes de fazer upload.
- O upload envia um snapshot completo de `finledger-backup.json`.
- Falhas temporárias mantêm `dirty = true` e disparam retries com exponential backoff.
- A V1 não usa fila granular de operações; isso fica reservado para uma futura sincronização bidirecional com merge.

Após conectar, a sincronização ocorre automaticamente em **background**, sem bloquear a UI, nos seguintes momentos:

- Ao abrir o app
- Sempre que uma transação for salva ou excluída
- Sempre que uma categoria for salva ou excluída

O arquivo `finledger-backup.json` no Drive é sobrescrito a cada sync com o estado completo e atual dos dados.

**Indicador visual:** ícone de nuvem discreto no canto da interface enquanto o sync está em andamento. Some ao concluir.

---

### 3.4 Restaurar do Drive

- Botão "Restaurar do Drive" visível apenas quando conectado
- Busca o arquivo `finledger-backup.json` da pasta do app no Drive
- Exibe modal de confirmação antes de prosseguir:
  > "Restaurar este backup vai substituir todos os seus dados atuais. Esta ação não pode ser desfeita. Deseja continuar?"
- Botões: "Restaurar" (vermelho) + "Cancelar"
- Ao confirmar: apaga todos os dados locais e importa os dados do arquivo do Drive
- Toast de sucesso: "Backup restaurado. X transações e Y categorias importadas."
- Toast de erro: "Erro ao restaurar backup" / "Arquivo não encontrado no Drive"

---

### 3.5 Estados da tela de Backup

| Estado | Visual |
|---|---|
| Desconectado | Botão "Conectar com Google" + descrição do que é o backup |
| Conectando | Loading no botão |
| Conectado | E-mail da conta · data/hora do último sync · botão "Restaurar do Drive" · botão "Desconectar" |
| Sincronizando | Ícone de nuvem animado discreto |
| Erro de sync | Mensagem de erro inline + botão "Tentar novamente" |

---

### 3.6 Navegação

Nova seção na sidebar em **Configurações**:

```
CONFIGURAÇÕES
  Categorias
  Importar / Exportar    ← renomeado (era "Importar Planilha")
  Backup                 ← novo
```

---

### 3.7 Formato do arquivo de backup (JSON)

```json
{
  "version": "1",
  "exportedAt": "2026-05-01T14:32:00Z",
  "transacoes": [
    {
      "id": 1,
      "descricao": "Salário",
      "valor": 3500.00,
      "data": "2026-05-01",
      "tipo": "receita",
      "categoria": "Salário",
      "obs": ""
    }
  ],
  "categorias": [
    {
      "id": 1,
      "nome": "Alimentação",
      "tipo": "despesa",
      "cor": "#fb923c"
    }
  ]
}
```

**Regras de restauração:**
- O campo `version` é validado — versões desconhecidas exibem erro
- IDs são ignorados (novos IDs gerados pelo banco)
- Categorias duplicadas por nome+tipo são ignoradas
- Transações são sempre importadas sem verificação de duplicata
- Recorrentes não fazem parte do backup na V1 inicial

---

## 4. Importar / Exportar

A tela "Importar Planilha" é renomeada para **"Importar / Exportar"** e ganha uma seção de exportação. A funcionalidade de importação existente permanece **inalterada**.

### 4.1 Layout da tela

A tela é dividida em duas seções visuais:

**Seção superior — Exportar dados:**
- Título "Exportar dados"
- Subtítulo "Baixe suas transações em CSV para usar em planilhas"
- Seletor de período: data início + data fim (padrão: primeiro e último dia do mês atual)
- Botão "Exportar CSV"

**Seção inferior — Importar dados:**
- Título "Importar dados"
- Conteúdo idêntico ao atual (dropzone, instruções, template)

---

### 4.2 Exportar CSV

**Comportamento:**
- Filtro por período: o usuário escolhe data início e data fim
- Ao clicar em "Exportar CSV": abre o diálogo nativo de salvar arquivo (via Tauri dialog plugin)
- Nome sugerido: `finledger-YYYY-MM-DD_YYYY-MM-DD.csv` (período selecionado)
- Exporta todas as transações do período, ordenadas por data decrescente

**Formato do CSV exportado** (mesmo modelo do template de importação, para compatibilidade):

```
Data,Descrição,Valor,Tipo,Categoria,Observação
15/01/2026,Supermercado,250.00,despesa,Alimentação,
01/01/2026,Salário,3500.00,receita,Salário,
```

- Datas no formato DD/MM/YYYY
- Valores sem símbolo de moeda, separador decimal ponto
- Cabeçalho sempre presente
- Coluna "Observação" incluída (vazia se não houver)

**Toast de sucesso:** "CSV exportado com sucesso"
**Toast de erro:** "Nenhuma transação encontrada no período" / "Erro ao exportar"

---

## 5. Transações Recorrentes

### 5.1 Visão geral

Uma transação recorrente é um modelo que gera automaticamente transações reais em datas configuradas. O usuário cadastra uma vez e o app cuida do resto.

**Exemplos de uso:**
- Aluguel de R$1.200 todo dia 5 do mês
- Assinatura de streaming de R$45 todo mês
- Salário de R$5.000 todo dia 1

---

### 5.2 Entidade: Recorrente

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | INTEGER | sim (PK, auto) | Identificador único |
| descricao | TEXT | sim | Descrição da transação gerada |
| valor | REAL | sim | Valor positivo |
| tipo | TEXT | sim | `"receita"` ou `"despesa"` |
| categoria | TEXT | sim | Nome da categoria |
| obs | TEXT | não | Observação livre |
| frequencia | TEXT | sim | `"diaria"`, `"semanal"`, `"mensal"`, `"anual"` |
| dia_vencimento | INTEGER | sim | Dia do mês (1–31) para mensal/anual; dia da semana (0–6, dom–sab) para semanal |
| mes_vencimento | INTEGER | não | Mês (1–12), obrigatório apenas para `"anual"` |
| ativa | INTEGER | sim | `1` = ativa, `0` = pausada |
| ultima_geracao | TEXT | não | Data ISO da última transação gerada (YYYY-MM-DD) |
| criada_em | TEXT | sim | Data ISO de criação da recorrente (YYYY-MM-DD), definida automaticamente |

---

### 5.3 Geração automática de transações

A geração ocorre **ao abrir o app**. O app verifica todas as recorrentes ativas e determina se há datas vencidas desde a `ultima_geracao`.

**Regras:**
- Só gera transações para datas **até hoje** (nunca futuras)
- Nunca gera transações anteriores a `criada_em`
- Se o app ficou fechado por vários meses, gera **todas as ocorrências vencidas** em sequência
- Após gerar, atualiza `ultima_geracao` com a data da última transação criada
- Transações geradas são **transações normais** — aparecem na lista, podem ser editadas ou excluídas sem afetar a recorrente
- Recorrentes pausadas (`ativa = 0`) não geram nada

**Exemplo:**
- Recorrente mensal, dia 5, última geração em 05/02/2026
- App aberto em 10/05/2026
- Gera: 05/03/2026, 05/04/2026, 05/05/2026 (3 transações)
- Atualiza `ultima_geracao` para 05/05/2026

---

### 5.4 Tela: Gerenciar Recorrentes

Nova tela na sidebar, seção **Lançamentos** — substitui "Nova Transação":

```
LANÇAMENTOS
  Transações
  Recorrentes        ← substitui "Nova Transação"
```

> "Nova Transação" deixa de ser item de navegação na sidebar. O lançamento é feito exclusivamente pelo botão "+ Nova transação" presente nas telas de Transações e Dashboard.

**Header:** título "Recorrentes" + subtítulo "Transações automáticas" + botão "Nova recorrente"

**Lista de recorrentes — cada item exibe:**
- Ponto colorido da categoria
- Descrição
- Frequência + dia (ex: "Mensal · dia 5", "Semanal · toda segunda")
- Valor com sinal (+ verde para receita / − vermelho para despesa)
- Badge de status: "Ativa" (verde) ou "Pausada" (cinza)
- Botões: pausar/retomar · editar · excluir

**Estado vazio:** ícone + "Nenhuma transação recorrente cadastrada"

---

### 5.5 Formulário: Nova / Editar Recorrente

Abre em **drawer lateral** (igual ao drawer de transações da V0.5).

| Campo | Componente | Validação |
|---|---|---|
| Tipo | Tabs "Despesa" / "Receita" | Obrigatório. Padrão: Despesa |
| Descrição | Input texto | Obrigatório |
| Valor | Input numérico com prefixo "R$" | Obrigatório, > 0 |
| Categoria | Select | Obrigatório, filtrado pelo tipo |
| Frequência | Select | Obrigatório. Opções: Diária, Semanal, Mensal, Anual |
| Dia | Depende da frequência (ver abaixo) | Obrigatório |
| Observação | Textarea | Opcional |

**Campo "Dia" por frequência:**
- **Diária:** campo oculto
- **Semanal:** select com dias da semana (Segunda … Domingo)
- **Mensal:** input numérico 1–31
- **Anual:** input numérico de dia (1–31) + select de mês (Janeiro–Dezembro)

**Ao salvar:**
- `ultima_geracao` fica vazio em novas recorrentes
- `criada_em` é definido automaticamente e não aparece no formulário
- Toast "Recorrente salva!"
- Drawer fecha, lista atualiza

**Ao excluir:**
- Modal: "Excluir esta recorrente não remove as transações já geradas. Deseja continuar?"
- Botões: "Excluir" (vermelho) + "Cancelar"

---

### 5.6 Indicador nas transações geradas

Transações geradas por recorrente exibem um indicador visual discreto na lista de Transações e no card de Últimas transações do Dashboard:
- Ícone de recorrência pequeno ao lado da descrição
- Tooltip ao hover: "Gerada automaticamente por recorrente"

---

## 6. Sidebar — Estado final após V1

```
VISÃO GERAL
  Dashboard

LANÇAMENTOS
  Transações
  Recorrentes

CONFIGURAÇÕES
  Categorias
  Importar / Exportar
  Backup
```

---

## 7. Critérios de Conclusão

**Backup:**
- [ ] Conectar Google Drive abre fluxo OAuth e armazena token localmente
- [ ] Fluxo OAuth usa PKCE, OAuth Client ID de desktop e escopo `drive.appdata`
- [ ] Após conectar, qualquer alteração nos dados dispara sync automático em background
- [ ] Sync é offline-first: salva local primeiro, marca `dirty`, aplica debounce e retry com backoff
- [ ] Ícone de nuvem aparece durante sync e some ao concluir
- [ ] Restaurar do Drive exibe confirmação e substitui os dados corretamente
- [ ] Desconectar remove o token e para a sincronização
- [ ] Seção "Backup" aparece na sidebar em Configurações

**Importar / Exportar:**
- [ ] Tela renomeada para "Importar / Exportar" na sidebar e no header
- [ ] Exportar CSV gera arquivo no formato correto com o período selecionado
- [ ] Período padrão é o mês atual
- [ ] Nome do arquivo exportado inclui o período selecionado
- [ ] Toast de erro quando não há transações no período
- [ ] Importação existente continua funcionando sem regressão

**Recorrentes:**
- [ ] Cadastrar recorrente com todas as frequências (diária, semanal, mensal, anual)
- [ ] Novas recorrentes recebem `criada_em` automaticamente
- [ ] Ao abrir o app, transações vencidas são geradas automaticamente
- [ ] Geração nunca cria transações antes de `criada_em`
- [ ] Recorrentes pausadas não geram transações
- [ ] Múltiplas ocorrências vencidas são geradas corretamente
- [ ] Transações geradas aparecem com indicador visual na lista e no Dashboard
- [ ] Pausar, retomar, editar e excluir recorrentes funciona corretamente
- [ ] Excluir recorrente não remove transações já geradas
- [ ] "Nova Transação" removido da sidebar; "Recorrentes" ocupa o lugar
- [ ] Dashboard tem botão "+ Nova transação" abrindo o drawer existente
