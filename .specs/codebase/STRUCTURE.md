# Estrutura de Diretórios

O FinLedger segue a arquitetura de **Monorepo** típica do Tauri, dividida rigidamente entre a aplicação Web (Raiz) e o Backend Nativo (`src-tauri`).

```text
finledger/
├── .specs/                     # Documentação viva do projeto lida pela IA
│   ├── codebase/               # Arquivos curtos de arquitetura e contexto
│   ├── features/               # Especificações e planejamento por versão
│   └── project/                # Roadmap geral do app
│
├── src/                        # 🎨 FRONTEND (HTML/CSS/JS Vanilla)
│   ├── index.html              # Ponto de entrada carregado pelo Vite
│   ├── main.js                 # Loader principal e registro de Eventos Tauri
│   ├── router.js               # Lógica simples de troca de "páginas"
│   ├── db.js                   # Camada de comunicação (invocadores Tauri)
│   ├── components/             # Reutilizáveis (drawer.js, sidebar.js, etc)
│   ├── screens/                # As telas em si (importar.js, transacoes.js)
│   └── utils.js                # Helpers (formatação de moeda, datas)
│
├── src-tauri/                  # ⚙️ BACKEND RUST
│   ├── src/
│   │   ├── main.rs             # Bootstrap do aplicativo Tauri
│   │   ├── lib.rs              # Registro dos plugins e commands invoke
│   │   └── db/                 # Módulo de lógica de negócios e persistência
│   │       ├── mod.rs          # Gerenciador de estado do banco
│   │       ├── schema.rs       # Inicializador e migrations SQLite
│   │       ├── transacoes.rs   # Lógica e SQL de Transações e CSV
│   │       ├── categorias.rs   # Lógica e SQL de Categorias
│   │       ├── recorrentes.rs  # Motor de transações repetitivas
│   │       └── oauth.rs        # Fluxo de Autenticação Google e Drive
│   ├── capabilities/           # Controle rígido de permissões do Tauri 2
│   ├── Cargo.toml              # Dependências Rust (crates)
│   └── tauri.conf.json         # Configuração da janela do SO (tamanho, título)
│
├── package.json                # Dependências frontend
└── vite.config.js              # Configurações do Vite
```
