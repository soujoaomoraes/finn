use rusqlite::params;
use crate::db::DbState;

#[tauri::command]
pub fn save_backup_metadata(key: String, value: String, state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
        params![key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_backup_metadata(key: String, state: tauri::State<DbState>) -> Result<Option<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let value = conn.query_row(
        "SELECT value FROM backup_metadata WHERE key = ?1",
        params![key],
        |row| row.get(0),
    ).ok();
    Ok(value)
}
