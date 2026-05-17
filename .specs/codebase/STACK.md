# Stack Tecnológico

| Camada | Tecnologia | Motivo e Observações |
|---|---|---|
| Shell Desktop | **Tauri 2** | Empacota o app como um executável de baixo consumo de memória, usando o webview do próprio sistema operacional. |
| Backend | **Rust** | Rápido, seguro em memória, lida com threads do SQLite e chamadas de rede (Backup Google Drive). |
| Banco de Dados | **SQLite via `tauri-plugin-sql`** | Banco de dados relacional embarcado no PC do usuário, garantindo a essência Offline-First e persistência de dados. |
| Dev Server & Build | **Vite** | Bundler moderno. Entrega Hot Module Replacement (HMR) e compila o código JS rapidamente. |
| Frontend | **Vanilla JS (ES Modules)** | Sem frameworks reativos complexos (React/Vue). Usamos componentes Vanilla com `import/export` nativos para máximo desempenho. |
| Estilização | **Vanilla CSS** | Uso intenso de CSS Variables e organização BEM. Evitou-se frameworks como Tailwind para total controle visual. |
| Importação Planilhas | **SheetJS** | Injetado localmente via script tag para realizar o parse seguro offline de arquivos sem subir para nenhum servidor. |
