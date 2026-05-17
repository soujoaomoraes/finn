# Referência Técnica para V1.1: Qualidade, Segurança e Testes

Este documento detalha o que precisa ser ajustado no código atual para a V1.1, focando em segurança, adoção de padrões de mercado e limpeza de código obsoleto.

## 1. Segurança e Padrões de Mercado (O que aplicamos e o que falta)

### 1.1 O "Client Secret" no Aplicativo Desktop
**O que fizemos:** Injetamos o `GOOGLE_CLIENT_SECRET` diretamente no binário durante o build (usando a macro `env!` do Rust).
**Isso é padrão de mercado?** **SIM**. Segundo a especificação oficial do OAuth 2.0 para Aplicativos Nativos (RFC 8252), aplicativos desktop são considerados "clientes públicos". O Google e a indústria sabem que o `client_secret` pode ser extraído caso um hacker faça engenharia reversa do executável de desktop.
A **verdadeira segurança** para desktop não vem de esconder esse secret, mas de duas práticas que **nós já implementamos com sucesso**:
1. **PKCE (Proof Key for Code Exchange):** Nós geramos um código criptográfico dinâmico a cada login. Se um hacker tentar simular o app, o Google bloqueará, pois ele não possui o "Code Verifier" temporário que geramos só na RAM durante a abertura da tela.
2. **Loopback Efêmero:** O app abre uma porta aleatória no computador local (ex: `127.0.0.1:54321`) em vez de uma fixa. Isso garante que nenhum outro programa malicioso na máquina consiga "roubar" a resposta do Google redirecionando para a porta que estaríamos escutando.

### 1.2 Padrões Recomendados que NÃO estamos adotando (A fazer na V1.1)
*   **Renovação Automática do Token (Refresh Token):** O token de acesso do Google Drive tem vida útil de apenas **1 hora**. Atualmente nós pegamos o `refresh_token` do Google e guardamos, mas *não usamos*. O que acontece hoje: se o usuário deixar o app aberto por mais de uma hora e tentar fazer backup, o Google vai rejeitar (Erro 401). **Recomendação:** O backend em Rust deve validar se o acesso expirou e usar o `refresh_token` para pegar um novo automaticamente de forma invisível antes do upload.
*   **Armazenamento em Cofre Nativo:** Hoje, salvamos os tokens dentro do banco `finledger.db` em texto puro. Se um software malicioso (vírus) copiar esse banco de dados, ele ganhará acesso à pasta oculta do usuário no Google Drive. **Recomendação:** Para lidar com credenciais confidenciais, deve-se usar os plugins `tauri-plugin-store` ou `tauri-plugin-stronghold` para encriptar os tokens usando a segurança do Sistema Operacional (Windows Credential Manager ou macOS Keychain).
*   **Criptografia do Banco SQLite (SQLCipher):** O banco de transações atual não possui senha. Qualquer pessoa logada no PC pode baixar um leitor de SQLite e ver todas as despesas da pessoa. **Recomendação:** Integrar SQLCipher (que já é suportado pelo nosso `tauri-plugin-sql`) para encriptar `finledger.db` com uma senha que só o app conheça.

## 2. Limpeza de Código e Dívida Técnica

Temos código antigo no arquivo `oauth.rs` que perdeu a utilidade devido às melhorias de segurança que criamos ao longo do desenvolvimento. Eles causam os `warnings` laranjas no seu terminal e devem ser apagados.

*   **`constant REDIRECT_URI`** (`oauth.rs:14`):
    *   **O que é:** Era uma porta fixa `http://localhost:8080`.
    *   **Onde está o código novo:** Na linha 110 geramos dinamicamente via `listener.local_addr().port()`. A constante ficou obsoleta.
*   **`struct OAuthToken`** (`oauth.rs:21`):
    *   **O que é:** Uma estrutura do Rust criada lá na primeira tentativa para receber o token.
    *   **Onde está o código novo:** Na linha 193 nós processamos o retorno flexível com `serde_json::Value`. A estrutura antiga nunca mais foi instanciada.
*   **`unused variable: oauth_state_clone`** (`oauth.rs:75`):
    *   **O que é:** Cópia do estado de segurança (State param).
    *   **Onde está o código novo:** Descobrimos que validar o estado solto na thread do TCP era ruim. Agora enviamos tudo pro banco de dados através da função `exchange_code_for_token_inner` (linha 158) que valida o estado lendo diretamente do SQLite de maneira muito mais atômica.
*   **`tauri::command exchange_code_for_token`** (`oauth.rs:234`):
    *   **O que é:** Esse é o comando que expunha o fluxo de troca de token para a interface gráfica no Javascript.
    *   **Onde está o código novo:** O Javascript não faz mais nada. Na linha 117 o próprio Rust percebe o retorno do Google e já finaliza a troca do Token pelas costas do navegador. Esse comando não é mais usado por ninguém e expõe o backend desnecessariamente. Pode ser deletado.
*   **`field exported_at is never read`** (`oauth.rs:488`):
    *   O campo existe na estrutura `RestoreBackupData` para mapear corretamente o JSON vindo do Google Drive, mas nós não lemos esse campo específico para nada depois de baixar (focamos só nas transações e categorias). O Rust avisa que estamos guardando uma variável que nunca é lida. Na V1.1 basta colocar a macro `#[allow(dead_code)]` acima dela.

## 3. Estratégia de Testes Automatizados

A estabilização exigirá testes sistemáticos em 3 níveis (utilizando a skill `testing-tauri-apps`):

*   **Testes Unitários no Backend:** Especialmente críticos para o módulo `recorrentes.rs`. Testar a função que calcula "Múltiplos meses atrasados" garante que não surjam duplicações misteriosas.
*   **Mock do Banco de Dados:** Substituir a conexão real do `finledger.db` nos testes por um banco descartável em RAM (`:memory:`). Assim os testes podem inserir dezenas de transações falsas e rodar o backup sem comprometer os dados pessoais do desenvolvedor durante a construção.
*   **Testes E2E (WebdriverIO):** Um teste de ponta a ponta simulando usuário. O Webdriver deverá ser capaz de rodar o executável Tauri, clicar em "Conectar ao Google Drive", confirmar o login via tela mockada e validar se o status mudou para "Conectado" na UI.

## 4. Observabilidade e Debugging

Atualmente confiamos em `eprintln!` espalhados sem um padrão para tentar entender se o upload falhou ou o JSON não parseou.

*   **Implementação:** Adicionar os pacotes de mercado `log` e `env_logger`. Em vez de imprimir só erros, teremos avisos de jornada: `log::info!("Iniciando escuta efêmera na porta {}")`.
*   **Por que:** Quando implementarmos a "Renovação Automática do Token" (item 1.2), muito processo ocorrerá no fundo silenciosamente sem interação com a UI. O dev precisará de um histórico claro para investigar falhas intermitentes de conexão na AWS ou na API do Google rodando o comando `RUST_LOG=debug npm run tauri dev`.
