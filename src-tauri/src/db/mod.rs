pub mod schema;
pub mod categorias;
pub mod transacoes;
pub mod recorrentes;
pub mod backup;
pub mod oauth;
pub mod token_store;
pub mod backup_models;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri_plugin_stronghold::stronghold::Stronghold;

pub struct DbState {
    pub conn: Mutex<Connection>,
    pub vault: Mutex<Stronghold>,
}
