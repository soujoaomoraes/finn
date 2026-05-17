# Visão Geral da Arquitetura (V1)

O FinLedger é um aplicativo desktop Offline-First construído com **Tauri 2**. 
O Tauri age como uma "casca nativa" que embute um webview com o frontend HTML/JS e se comunica com o backend em Rust.

## Comunicação (IPC - Inter-Process Communication)

O frontend não possui acesso direto ao banco de dados ou ao sistema de arquivos. A comunicação acontece via **Commands** do Tauri, chamados através da função `invoke()` no JavaScript.

```text
┌─────────────────────────────────────────────┐
│                  Tauri Shell                │
│                                             │
│  ┌──────────────────┐  invoke()  ┌────────┐ │
│  │   Frontend       │ ────────── │  Rust  │ │
│  │   HTML/CSS/JS    │ ←───────── │ Backend│ │
│  │   (Webview)      │   Retorno  │        │ │
│  └──────────────────┘            └───┬────┘ │
│                                      │      │
│                               ┌──────▼────┐ │
│                               │  SQLite   │ │
│                               │  (local)  │ │
│                               └───────────┘ │
└─────────────────────────────────────────────┘
```

## Fluxo de Dados Básico
1. A UI captura a interação do usuário (ex: botão Salvar Transação).
2. O JavaScript chama o comando `invoke('save_transacao', { ... })`.
3. O comando Rust bloqueia o acesso seguro ao banco SQLite (`state.conn.lock()`) e executa a query.
4. O Rust retorna sucesso ou o erro serializado para o JavaScript.
5. O JavaScript atualiza a tela e exibe feedbacks visuais (toasts).
