pub mod schema;
pub mod categorias;
pub mod transacoes;

use rusqlite::Connection;
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}
