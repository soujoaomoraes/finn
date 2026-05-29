pub mod backup;
pub mod backup_models;
pub mod categorias;
pub mod oauth;
pub mod recorrentes;
pub mod schema;
pub mod token_store;
pub mod transacoes;

use rusqlite::Connection;
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}
