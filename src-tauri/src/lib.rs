mod infrastructure;
mod modules;

use infrastructure::db::DbState;
use modules::{backup, categories, recurring, transactions, reserves, metas};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("failed to create app data dir");

            let db_path = app_data_dir.join("finledger.db");

            let db_key =
                infrastructure::vault::token_store::get_or_create_db_key().expect("Failed to load SQLCipher database key");

            infrastructure::db::schema::init(db_path.clone(), &db_key).expect("Failed to initialize database schema");

            let conn = Connection::open(&db_path).expect("Failed to open connection");
            conn.pragma_update(None, "key", &db_key)
                .expect("Failed to unlock encrypted database");

            app.manage(DbState {
                conn: Mutex::new(conn),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            categories::get_all_categorias,
            categories::save_categoria,
            categories::delete_categoria,
            transactions::get_all_transacoes,
            transactions::save_transacao,
            transactions::delete_transacao,
            transactions::export::export_csv,
            recurring::get_all_recorrentes,
            recurring::save_recorrente,
            recurring::delete_recorrente,
            recurring::toggle_recorrente,
            recurring::generate_due_recorrentes,
            backup::save_backup_metadata,
            backup::get_backup_metadata,
            backup::upload_backup_to_drive,
            backup::clear_retry_metadata,
            backup::restore_from_drive,
            backup::oauth::connect_google_drive,
            backup::oauth::disconnect_google_drive,
            backup::oauth::is_drive_connected,
            reserves::get_reserva_saldos,
            reserves::transferir_reserva,
            metas::get_all_metas,
            metas::save_meta,
            metas::delete_meta,
            metas::toggle_meta
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}