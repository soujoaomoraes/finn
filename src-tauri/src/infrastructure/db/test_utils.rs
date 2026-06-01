use rusqlite::Connection;

pub fn test_db_connection() -> Result<Connection, String> {
    let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS categorias (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            nome      TEXT    NOT NULL,
            tipo      TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa')),
            cor       TEXT    NOT NULL
        );
        CREATE TABLE IF NOT EXISTS transacoes (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao  TEXT    NOT NULL,
            valor      REAL    NOT NULL CHECK(valor > 0),
            data       TEXT    NOT NULL,
            tipo       TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa')),
            categoria  TEXT    NOT NULL,
            obs        TEXT    DEFAULT '',
            recorrente_id INTEGER DEFAULT NULL
        );
        CREATE TABLE IF NOT EXISTS recorrentes (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao         TEXT    NOT NULL,
            valor             REAL    NOT NULL CHECK(valor > 0),
            tipo              TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa')),
            categoria         TEXT    NOT NULL,
            obs               TEXT    DEFAULT '',
            frequencia        TEXT    NOT NULL CHECK(frequencia IN ('mensal', 'semanal', 'quinzenal', 'anual')),
            dia_vencimento    INTEGER,
            proximo_vencimento TEXT    NOT NULL,
            ativo             INTEGER NOT NULL DEFAULT 1,
            data_inicio       TEXT    NOT NULL
        );"
    ).map_err(|e| e.to_string())?;

    conn.execute_batch(
        "INSERT INTO categorias (nome, tipo, cor) VALUES
            ('Alimentação', 'despesa', '#fb923c'),
            ('Salário', 'receita', '#4ade80');"
    ).map_err(|e| e.to_string())?;

    Ok(conn)
}