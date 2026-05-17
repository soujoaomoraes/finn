mod db;

use db::{categorias, schema, transacoes, recorrentes, backup, oauth, DbState};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("failed to create app data dir");
            let db_path = app_data_dir.join("finledger.db");

            // Initializes schema and seeds default categories if empty
            schema::init(db_path.clone()).expect("Failed to initialize database schema");
            
            // Keeps a persistent connection in the app state
            let conn = Connection::open(&db_path).expect("Failed to open connection");
            
            app.manage(DbState {
                conn: Mutex::new(conn)
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
            oauth::connect_google_drive,
            oauth::exchange_code_for_token,
            oauth::disconnect_google_drive,
            oauth::is_drive_connected,
            oauth::upload_backup_to_drive,
            oauth::clear_retry_metadata,
            oauth::restore_from_drive
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
