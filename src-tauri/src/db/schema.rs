use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub fn init(db_path: PathBuf) -> Result<()> {
    let conn = Connection::open(&db_path)?;

    // Cria as tabelas
    conn.execute(
        "CREATE TABLE IF NOT EXISTS categorias (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            nome      TEXT    NOT NULL,
            tipo      TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa')),
            cor       TEXT    NOT NULL
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS transacoes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao  TEXT    NOT NULL,
            valor      REAL    NOT NULL CHECK(valor > 0),
            data       TEXT    NOT NULL,
            tipo       TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa')),
            categoria  TEXT    NOT NULL,
            obs        TEXT    DEFAULT '',
            recorrente_id INTEGER DEFAULT NULL
        );",
        [],
    )?;

    // Add recorrente_id column if it doesn't exist (idempotent migration)
    let _ = conn.execute(
        "ALTER TABLE transacoes ADD COLUMN recorrente_id INTEGER DEFAULT NULL",
        [],
    );

    conn.execute(
        "CREATE TABLE IF NOT EXISTS recorrentes (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao         TEXT    NOT NULL,
            valor             REAL    NOT NULL CHECK(valor > 0),
            tipo              TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa')),
            categoria         TEXT    NOT NULL,
            obs               TEXT    DEFAULT '',
            frequencia        TEXT    NOT NULL CHECK(frequencia IN ('mensal', 'semanal', 'quinzenal')),
            dia_vencimento    INTEGER,
            proximo_vencimento TEXT    NOT NULL,
            ativo             INTEGER NOT NULL DEFAULT 1,
            data_inicio       TEXT    NOT NULL
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS backup_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );",
        [],
    )?;

    // Verifica seed
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM categorias", [], |row| row.get(0))?;

    if count == 0 {
        conn.execute_batch(
            "INSERT INTO categorias (nome, tipo, cor) VALUES
            ('Alimentação', 'despesa', '#fb923c'),
            ('Transporte', 'despesa', '#60a5fa'),
            ('Moradia', 'despesa', '#818cf8'),
            ('Saúde', 'despesa', '#f472b6'),
            ('Lazer', 'despesa', '#4ade80'),
            ('Educação', 'despesa', '#22d3ee'),
            ('Outros', 'despesa', '#94a3b8'),
            ('Salário', 'receita', '#4ade80'),
            ('Freelance', 'receita', '#34d399'),
            ('Investimentos', 'receita', '#fbbf24'),
            ('Outros', 'receita', '#94a3b8');"
        )?;
    }

    Ok(())
}
