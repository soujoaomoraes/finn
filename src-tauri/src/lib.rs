mod db;

use db::{backup, categorias, oauth, recorrentes, schema, token_store, transacoes, DbState};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_stronghold::stronghold::Stronghold;

const VAULT_PASSWORD: &[u8] = b"finledger-stronghold-v1-password";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("failed to create app data dir");
            let db_path = app_data_dir.join("finledger.db");
            let vault_path = app_data_dir.join("finledger.stronghold");
            let vault = Mutex::new(
                Stronghold::new(vault_path, VAULT_PASSWORD.to_vec())
                    .expect("Failed to initialize Stronghold vault"),
            );
            let db_key = token_store::get_or_create_db_key(&vault)
                .expect("Failed to load SQLCipher database key");

            // Initializes schema and seeds default categories if empty
            schema::init(db_path.clone(), &db_key).expect("Failed to initialize database schema");
            
            // Keeps a persistent connection in the app state
            let conn = Connection::open(&db_path).expect("Failed to open connection");
            conn.pragma_update(None, "key", &db_key).expect("Failed to unlock encrypted database");
            
            app.manage(DbState {
                conn: Mutex::new(conn),
                vault,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            categorias::get_all_categorias,
            categorias::save_categoria,
            categorias::delete_categoria,
            transacoes::get_all_transacoes,
            transacoes::save_transacao,
            transacoes::delete_transacao,
            transacoes::export_csv,
            recorrentes::get_all_recorrentes,
            recorrentes::save_recorrente,
            recorrentes::delete_recorrente,
            recorrentes::toggle_recorrente,
            recorrentes::generate_due_recorrentes,
            backup::save_backup_metadata,
            backup::get_backup_metadata,
            backup::upload_backup_to_drive,
            backup::clear_retry_metadata,
            backup::restore_from_drive,
            oauth::connect_google_drive,
            oauth::disconnect_google_drive,
            oauth::is_drive_connected
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
