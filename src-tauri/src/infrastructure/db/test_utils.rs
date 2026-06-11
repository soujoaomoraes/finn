use rusqlite::Connection;

pub fn test_db_connection() -> Result<Connection, String> {
    let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS categorias (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            nome      TEXT    NOT NULL,
            tipo      TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa', 'reserva')),
            cor       TEXT    NOT NULL
        );
        CREATE TABLE IF NOT EXISTS transacoes (
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
        CREATE TABLE IF NOT EXISTS recorrentes (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao         TEXT    NOT NULL,
            valor             REAL    NOT NULL CHECK(valor > 0),
            tipo              TEXT    NOT NULL CHECK(tipo IN ('receita', 'despesa', 'reserva')),
            categoria         TEXT    NOT NULL,
            obs               TEXT    DEFAULT '',
            frequencia        TEXT    NOT NULL CHECK(frequencia IN ('mensal', 'semanal', 'quinzenal', 'anual')),
            dia_vencimento    INTEGER,
            proximo_vencimento TEXT    NOT NULL,
            ativo             INTEGER NOT NULL DEFAULT 1,
            data_inicio       TEXT    NOT NULL
        );
        CREATE TABLE IF NOT EXISTS metas (
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
        );"
    ).map_err(|e| e.to_string())?;

    conn.execute_batch(
        "INSERT INTO categorias (nome, tipo, cor) VALUES
            ('Alimentação', 'despesa', '#fb923c'),
            ('Salário', 'receita', '#4ade80');"
    ).map_err(|e| e.to_string())?;

    Ok(conn)
}