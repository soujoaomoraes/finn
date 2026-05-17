pub mod schema;
pub mod categorias;
pub mod transacoes;
pub mod recorrentes;
pub mod backup;
pub mod oauth;

use rusqlite::Connection;
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}
