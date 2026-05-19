# FinLedger Testing Standards

Este documento estabelece as diretrizes, matriz de cobertura e comandos para testar o aplicativo FinLedger (Tauri v2 + Rust + Vanilla JS).

## 1. Test Coverage Matrix

A tabela abaixo define que tipo de teste é exigido para cada camada do código.

| Code Layer / Component | Test Type Required | Automation Level | Notes |
| --- | --- | --- | --- |
| **Rust: Regras de Negócio** (ex: `recorrentes.rs`) | Unit | Automático | Deve cobrir cálculos complexos e casos de borda sem tocar no banco principal. |
| **Rust: Persistência (CRUD)** (ex: `transacoes.rs`) | Unit (com mock DB) | Automático | Banco em memória (`:memory:`) injetado nos testes. |
| **Rust: Integrações Externas** (ex: `oauth.rs`) | Manual / Unit | Híbrido | Validação manual via Logs ou mock de server em testes unitários. |
| **Frontend: UI/Componentes** (ex: `dashboard.js`) | E2E | Automático | Validação visual garantida pelo WebdriverIO através de fluxos completos. |
| **Frontend: Fluxos de Usuário** | E2E | Automático | WebdriverIO roda o app nativo simulando cliques e preenchimentos. |

## 2. Gate Check Commands

Os *Gate Checks* são os comandos que devem ser rodados antes de considerar uma tarefa como "Done" ou antes de realizar um commit.

| Gate Level | Command | When to Use |
| --- | --- | --- |
| **Quick** | `cargo check && npm run build` | Durante desenvolvimento contínuo (validar compilação e tipagem). |
| **Test** | `cargo test` | Após alterar o backend Rust, especialmente módulos com lógica isolada. |
| **Full** | `cargo test && npm run test:e2e` | Antes de fechar uma feature inteira ou submeter Pull Request. |

## 3. Parallelism Assessment

A validação de concorrência é essencial para quando múltiplas tarefas estão sendo executadas ao mesmo tempo por sub-agentes (flag `[P]`).

| Test Type | Parallel-Safe | Justification |
| --- | --- | --- |
| **Unit (Rust)** | Yes | O `cargo test` roda os testes de forma concorrente por padrão no Rust. Bancos `:memory:` são locais à thread. |
| **E2E (WebdriverIO)** | No | O E2E levanta o binário da aplicação e assume controle exclusivo da tela e banco de dados temporário. Um teste pode interferir no estado do outro. |

## 4. Como Executar e Criar Testes

### Testes Unitários em Rust
Para escrever um teste em Rust, crie um submódulo `tests` no mesmo arquivo da implementação:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculo_simples() {
        assert_eq!(1 + 1, 2);
    }
}
```
**Para rodar:** `cargo test` (na raiz do projeto ou dentro de `src-tauri`).

### Testes de Banco de Dados com Mock
Para testar operações do SQLite sem alterar os dados do usuário no app, o módulo de testes deve instanciar uma conexão limpa em memória:

```rust
#[cfg(test)]
mod tests {
    use rusqlite::Connection;
    // Função hipotética exportada pelo `db/schema.rs` ou `mod.rs`
    use crate::db::run_migrations;

    fn get_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        conn
    }
}
```

### Testes E2E (End-to-End)
Os testes E2E usam **WebdriverIO** para interagir diretamente com o app compilado do Tauri, de ponta a ponta.
- Eles ficam na pasta `test/e2e/`.
- Executam subindo uma build de dev ou release do Tauri, aguardando o carregamento da Window, e disparando cliques nos botões reais.
- **Para rodar:** `npm run test:e2e` (Comando a ser configurado na Tarefa T17).
