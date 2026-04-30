# FinLedger 💰

**FinLedger** é um aplicativo desktop leve e rápido para gestão de finanças pessoais. Ele permite o controle offline e seguro de suas receitas e despesas, visualização de saldos mensais e importação de dados através de planilhas de forma super intuitiva.

## 🚀 Tecnologias

Este projeto foi construído focando em performance, baixo consumo de memória e total privacidade dos dados (tudo fica no seu computador).

- **Frontend:** HTML5, CSS3 e Vanilla JavaScript (sem frameworks pesados).
- **Backend:** [Tauri 2](https://v2.tauri.app/) e [Rust](https://www.rust-lang.org/) para a comunicação com o sistema operacional.
- **Banco de Dados:** SQLite embutido via `tauri-plugin-sql` para armazenar transações e categorias localmente.

## 📦 Funcionalidades Principais

- **Dashboard:** Resumo mensal do seu saldo, despesas e receitas.
- **Transações:** Listagem, filtro, busca, criação, edição e exclusão de transações.
- **Categorias:** Gerenciamento completo de categorias customizadas por cor.
- **Importação:** Importe suas despesas em massa a partir de um arquivo de planilha (`.xlsx` ou `.csv`).
- **Modo Offline:** Funciona sem necessidade de internet, com o banco persistido diretamente na sua máquina.

## 💻 Como Rodar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install)
- Dependências de compilação do Tauri para seu SO (Siga o guia [aqui](https://v2.tauri.app/start/prerequisites/)).

### Instalação e Execução

1. Clone o repositório:
```bash
git clone https://github.com/SEU_USUARIO/finledger.git
cd finledger
```

2. Instale as dependências Node:
```bash
npm install
```

3. Execute em modo de desenvolvimento:
```bash
npm run tauri dev
```

4. Para compilar o executável final para o seu sistema:
```bash
npm run tauri build
```

## 📄 Licença

Este projeto é de código aberto e está licenciado sob a **GNU General Public License v3.0 (GPLv3)**. 
Isso significa que você é livre para usar, estudar, modificar e compartilhar o software. No entanto, qualquer trabalho derivado ou modificado que for distribuído também deve ser disponibilizado sob a mesma licença GPLv3 com o código-fonte aberto. O uso comercial e monetização são permitidos, desde que essas regras sejam respeitadas.
