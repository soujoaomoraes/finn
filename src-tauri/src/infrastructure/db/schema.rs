use rusqlite::Connection;
use std::path::{Path, PathBuf};

pub fn init(db_path: PathBuf, db_key: &str) -> Result<(), String> {
    migrate_plaintext_database_if_needed(&db_path, db_key)?;

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    conn.pragma_update(None, "key", db_key).map_err(|e| e.to_string())?;

    // Cria as tabelas
    conn.execute(
        "CREATE TABLE IF NOT EXISTS categorias (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            nome      TEXT    NOT NULL,
            tipo      TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa', 'reserva')),
            cor       TEXT    NOT NULL
        );",
        [],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS transacoes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao  TEXT    NOT NULL,
            valor      REAL    NOT NULL CHECK(valor > 0),
            data       TEXT    NOT NULL,
            tipo       TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa', 'reserva')),
            categoria  TEXT    NOT NULL,
            obs        TEXT    DEFAULT '',
            recorrente_id INTEGER DEFAULT NULL,
            reserva_id INTEGER DEFAULT NULL,
            is_transferencia INTEGER NOT NULL DEFAULT 0,
            transferencia_par_id INTEGER DEFAULT NULL
        );",
        [],
    ).map_err(|e| e.to_string())?;

    // Add columns if they don't exist (idempotent migration)
    let _ = conn.execute("ALTER TABLE transacoes ADD COLUMN recorrente_id INTEGER DEFAULT NULL", []);
    let _ = conn.execute("ALTER TABLE transacoes ADD COLUMN reserva_id INTEGER DEFAULT NULL", []);
    let _ = conn.execute("ALTER TABLE transacoes ADD COLUMN is_transferencia INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE transacoes ADD COLUMN transferencia_par_id INTEGER DEFAULT NULL", []);

    // Migration for CHECK constraints in categorias and transacoes
    let table_sql: String = conn.query_row(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='categorias'",
        [],
        |row| row.get(0),
    ).unwrap_or_default();

    if !table_sql.contains("'reserva'") {
        let _ = conn.execute_batch(
            "PRAGMA foreign_keys=off;
            BEGIN TRANSACTION;

            CREATE TABLE categorias_new (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                nome      TEXT    NOT NULL,
                tipo      TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa', 'reserva')),
                cor       TEXT    NOT NULL
            );
            INSERT INTO categorias_new SELECT * FROM categorias;
            DROP TABLE categorias;
            ALTER TABLE categorias_new RENAME TO categorias;

            CREATE TABLE transacoes_new (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                descricao  TEXT    NOT NULL,
                valor      REAL    NOT NULL CHECK(valor > 0),
                data       TEXT    NOT NULL,
                tipo       TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa', 'reserva')),
                categoria  TEXT    NOT NULL,
                obs        TEXT    DEFAULT '',
                recorrente_id INTEGER DEFAULT NULL,
                reserva_id INTEGER DEFAULT NULL,
                is_transferencia INTEGER NOT NULL DEFAULT 0,
                transferencia_par_id INTEGER DEFAULT NULL
            );
            INSERT INTO transacoes_new SELECT * FROM transacoes;
            DROP TABLE transacoes;
            ALTER TABLE transacoes_new RENAME TO transacoes;

            COMMIT;
            PRAGMA foreign_keys=on;"
        );
    }

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
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS backup_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );",
        [],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS metas (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria_id INTEGER NOT NULL,
            tipo         TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa', 'reserva')),
            valor_meta   REAL    NOT NULL CHECK(valor_meta > 0),
            periodo      TEXT    NOT NULL DEFAULT 'mensal'
                         CHECK(periodo IN ('mensal', 'trimestral', 'anual', 'especifico')),
            data_inicio  TEXT    NOT NULL,
            data_limite  TEXT,
            ativa        INTEGER NOT NULL DEFAULT 1,
            created_at   TEXT    NOT NULL,
            updated_at   TEXT    NOT NULL
        );",
        [],
    ).map_err(|e| e.to_string())?;

    // Verifica seed
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM categorias", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

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
            ('Outros', 'receita', '#94a3b8'),
            ('Reserva de emergência', 'reserva', '#4ade80'),
            ('Viagem fim do ano', 'reserva', '#60a5fa'),
            ('Carro novo', 'reserva', '#c084fc');"
        ).map_err(|e| e.to_string())?;
    } else {
        let reserva_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM categorias WHERE tipo = 'reserva'", [], |row| row.get(0))
            .unwrap_or(0);

        if reserva_count == 0 {
            let _ = conn.execute_batch(
                "INSERT INTO categorias (nome, tipo, cor) VALUES
                ('Reserva de emergência', 'reserva', '#4ade80'),
                ('Viagem fim do ano', 'reserva', '#60a5fa'),
                ('Carro novo', 'reserva', '#c084fc');"
            );
        }
    }

    Ok(())
}

fn migrate_plaintext_database_if_needed(db_path: &Path, db_key: &str) -> Result<(), String> {
    if !db_path.exists() || encrypted_database_opens(db_path, db_key) {
        return Ok(());
    }

    if !plaintext_database_opens(db_path) {
        return Err("Database exists, but it is neither readable with the SQLCipher key nor as plaintext".to_string());
    }

    log::warn!("Migrating existing plaintext database to SQLCipher");

    let encrypted_path = db_path.with_extension("encrypted.tmp");
    let backup_path = db_path.with_extension("plaintext.bak");
    let _ = std::fs::remove_file(&encrypted_path);

    {
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let encrypted_path_sql = sql_quote(&encrypted_path.to_string_lossy());
        let key_sql = sql_quote(db_key);

        conn.execute_batch(&format!(
            "ATTACH DATABASE '{}' AS encrypted KEY '{}';
             SELECT sqlcipher_export('encrypted');
             DETACH DATABASE encrypted;",
            encrypted_path_sql, key_sql
        ))
        .map_err(|e| e.to_string())?;
    }

    if backup_path.exists() {
        std::fs::remove_file(&backup_path).map_err(|e| e.to_string())?;
    }

    std::fs::rename(db_path, &backup_path).map_err(|e| e.to_string())?;
    std::fs::rename(&encrypted_path, db_path).map_err(|e| e.to_string())?;

    log::info!(
        "Plaintext database migrated to SQLCipher; backup kept at {}",
        backup_path.display()
    );
    Ok(())
}

fn encrypted_database_opens(db_path: &Path, db_key: &str) -> bool {
    let Ok(conn) = Connection::open(db_path) else {
        return false;
    };
    if conn.pragma_update(None, "key", db_key).is_err() {
        return false;
    }
    conn.query_row("SELECT count(*) FROM sqlite_master", [], |row| row.get::<_, i64>(0))
        .is_ok()
}

fn plaintext_database_opens(db_path: &Path) -> bool {
    let Ok(conn) = Connection::open(db_path) else {
        return false;
    };
    conn.query_row("SELECT count(*) FROM sqlite_master", [], |row| row.get::<_, i64>(0))
        .is_ok()
}

fn sql_quote(value: &str) -> String {
    value.replace('\'', "''")
}
