pub mod backup;
pub mod backup_models;
pub mod categorias;
pub mod oauth;
pub mod recorrentes;
pub mod schema;
pub mod token_store;
pub mod transacoes;

#[cfg(test)]
pub mod test_utils;

use rusqlite::Connection;
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}
