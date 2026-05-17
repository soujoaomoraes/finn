# Banco de Dados e Esquemas

O banco de dados do app vive localmente em um arquivo `finledger.db` guardado na pasta padrão `AppData` (Windows) ou `Application Support` (Mac/Linux).

## Estrutura das Tabelas (V1)

```sql
-- 1. CATEGORIAS: Gerencia cores e tipos
CREATE TABLE IF NOT EXISTS categorias (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT    NOT NULL,
  tipo      TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa')),
  cor       TEXT    NOT NULL
);

-- 2. TRANSACOES: Registro financeiro em si
CREATE TABLE IF NOT EXISTS transacoes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao      TEXT    NOT NULL,
  valor          REAL    NOT NULL CHECK(valor > 0),
  data           TEXT    NOT NULL,  -- YYYY-MM-DD
  tipo           TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa')),
  categoria      TEXT    NOT NULL,
  obs            TEXT    DEFAULT '',
  recorrente_id  INTEGER            -- Chave estrangeira lógica
);

-- 3. RECORRENTES: Templates que geram novas transações automaticamente
CREATE TABLE IF NOT EXISTS recorrentes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao      TEXT    NOT NULL,
  valor          REAL    NOT NULL CHECK(valor > 0),
  tipo           TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa')),
  categoria      TEXT    NOT NULL,
  frequencia     TEXT    NOT NULL CHECK(frequencia IN ('diario', 'semanal', 'mensal', 'anual')),
  data_inicio    TEXT    NOT NULL,
  ultima_geracao TEXT,
  ativo          INTEGER NOT NULL DEFAULT 1 -- Boolean
);

-- 4. BACKUP_METADATA: Armazena estado e tokens (Key-Value simples)
CREATE TABLE IF NOT EXISTS backup_metadata (
  key            TEXT    PRIMARY KEY,
  value          TEXT    NOT NULL
);
```

## Bootstrap
Quando o app abre e cria as tabelas pela primeira vez, ele automaticamente insere (Seed) 11 categorias essenciais padronizadas para facilitar a adoção do usuário.
