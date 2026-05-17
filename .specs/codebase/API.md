# API e Comandos Tauri

Este documento serve de índice dos comandos expostos pelo Backend para serem chamados no Frontend via `invoke()`.

> Todos os comandos no Tauri mapeiam as entradas JS (ex: `camelCase`) para parâmetros Rust (`snake_case`).

## Transações
- `get_all_transacoes`: Retorna todas as transações (ordenadas por data decrescente).
- `save_transacao({ transacao })`: Executa INSERT ou UPDATE (se ID > 0). Retorna o ID.
- `delete_transacao({ id })`: Remove transação.
- `export_csv({ startDate, endDate, filePath })`: Executa a gravação nativa do Rust exportando o relátorio em formato compatível com Excel PT-BR.

## Categorias
- `get_all_categorias`: Retorna categorias.
- `save_categoria({ categoria })`: Insere/Atualiza. Retorna o ID.
- `delete_categoria({ id })`: Remove categoria.

## Recorrentes
- `get_all_recorrentes`: Lista os templates cadastrados.
- `save_recorrente({ recorrente })`: Insere/Atualiza. Retorna ID.
- `delete_recorrente({ id })`: Deleta o template.
- `toggle_recorrente({ id, ativo })`: Ativa/Desativa a geração futura.
- `generate_due_recorrentes`: Chamado pelo frontend no boot. Checa todos os templates ativos e insere na tabela de transações os dias que faltam de acordo com as regras de repetição.

## Backup e OAuth Drive
- `connect_google_drive`: Abre janela do navegador solicitando login (via URL dinâmico/PKCE) e inicia listener efêmero TCP para capturar o redirecionamento.
- `is_drive_connected`: Retorna `true` se o token OAuth existir.
- `disconnect_google_drive`: Limpa tokens na tabela metadata.
- `upload_backup_to_drive`: Junta tabelas em um JSON único, formata, checa conexão e salva silenciosamente na pasta `appDataFolder` invisível do Google Drive.
- `restore_from_drive`: Substitui o banco de dados local com o arquivo mais recente da nuvem.
