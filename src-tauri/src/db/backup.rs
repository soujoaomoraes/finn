use crate::db::{
    backup_models::{BackupData, RestoreBackupData},
    token_store, DbState,
};
use rusqlite::params;

fn google_client_id() -> &'static str {
    env!("GOOGLE_CLIENT_ID")
}

fn google_client_secret() -> &'static str {
    env!("GOOGLE_CLIENT_SECRET")
}

fn drive_token() -> Result<String, String> {
    token_store::get_valid_access_token(google_client_id(), google_client_secret())
}

#[tauri::command]
pub fn save_backup_metadata(
    key: String,
    value: String,
    state: tauri::State<DbState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_backup_metadata(
    key: String,
    state: tauri::State<DbState>,
) -> Result<Option<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let value = conn
        .query_row(
            "SELECT value FROM backup_metadata WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .ok();
    Ok(value)
}

#[tauri::command]
pub fn upload_backup_to_drive(state: tauri::State<DbState>) -> Result<(), String> {
    log::info!("Starting Google Drive backup upload");
    let access_token = drive_token()?;
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let retry_count: u32 = conn
        .query_row(
            "SELECT value FROM backup_metadata WHERE key = ?1",
            params!["retry_count"],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let delay_ms = if retry_count == 0 {
        0
    } else {
        (1000u64 * 2u64.pow(retry_count.min(5))).min(60000)
    };

    if delay_ms > 0 {
        log::warn!(
            "Retrying backup after {}ms, retry #{}",
            delay_ms,
            retry_count
        );
        std::thread::sleep(std::time::Duration::from_millis(delay_ms));
    }

    let mut transacoes = Vec::new();
    let mut stmt = conn.prepare("SELECT id, data, descricao, valor, tipo, categoria, obs FROM transacoes ORDER BY data DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "data": row.get::<_, String>(1)?,
                "descricao": row.get::<_, String>(2)?,
                "valor": row.get::<_, f64>(3)?,
                "tipo": row.get::<_, String>(4)?,
                "categoria": row.get::<_, String>(5)?,
                "obs": row.get::<_, String>(6)?,
            }))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        transacoes.push(row.map_err(|e| e.to_string())?);
    }

    let mut categorias = Vec::new();
    let mut stmt = conn
        .prepare("SELECT nome, tipo, cor FROM categorias ORDER BY nome")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "nome": row.get::<_, String>(0)?,
                "tipo": row.get::<_, String>(1)?,
                "cor": row.get::<_, String>(2)?,
            }))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        categorias.push(row.map_err(|e| e.to_string())?);
    }

    let backup = BackupData {
        version: "1.0".to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        transacoes,
        categorias,
    };
    let backup_json = serde_json::to_string(&backup).map_err(|e| e.to_string())?;
    let client = reqwest::blocking::Client::new();

    let check_response = client
        .get("https://www.googleapis.com/drive/v3/files")
        .query(&[
            (
                "q",
                "name='finledger-backup.json' and 'appDataFolder' in parents",
            ),
            ("spaces", "appDataFolder"),
        ])
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .send()
        .map_err(|e| format!("Failed to check file: {}", e))?;

    let check_data: serde_json::Value = check_response
        .json()
        .map_err(|e| format!("Failed to parse check response: {}", e))?;

    let upload_result = if let Some(files) = check_data["files"].as_array() {
        if let Some(existing) = files.first() {
            let file_id = existing["id"].as_str().ok_or("Missing file id")?;
            let update_response = client
                .patch(&format!(
                    "https://www.googleapis.com/upload/drive/v3/files/{}?uploadType=media",
                    file_id
                ))
                .header("Authorization", format!("Bearer {}", access_token))
                .header("Content-Type", "application/json")
                .body(backup_json)
                .send()
                .map_err(|e| format!("Failed to update file: {}", e))?;

            if update_response.status().is_success() {
                Ok(())
            } else {
                Err(format!(
                    "Failed to update file: {}",
                    update_response.status()
                ))
            }
        } else {
            let metadata = serde_json::json!({
                "name": "finledger-backup.json",
                "parents": ["appDataFolder"]
            });

            let create_response = client
                .post("https://www.googleapis.com/drive/v3/files")
                .header("Authorization", format!("Bearer {}", access_token))
                .header("Content-Type", "application/json; charset=UTF-8")
                .json(&metadata)
                .send()
                .map_err(|e| format!("Failed to create file metadata: {}", e))?;

            if !create_response.status().is_success() {
                Err(format!(
                    "Failed to create file metadata: {}",
                    create_response.status()
                ))
            } else {
                let file_data: serde_json::Value = create_response
                    .json()
                    .map_err(|e| format!("Failed to parse file data: {}", e))?;
                let file_id = file_data["id"].as_str().ok_or("Missing file id")?;
                let upload_response = client
                    .patch(&format!(
                        "https://www.googleapis.com/upload/drive/v3/files/{}?uploadType=media",
                        file_id
                    ))
                    .header("Authorization", format!("Bearer {}", access_token))
                    .header("Content-Type", "application/json")
                    .body(backup_json)
                    .send()
                    .map_err(|e| format!("Failed to upload content: {}", e))?;

                if upload_response.status().is_success() {
                    Ok(())
                } else {
                    Err(format!(
                        "Failed to upload content: {}",
                        upload_response.status()
                    ))
                }
            }
        }
    } else {
        Err(format!(
            "Failed to check files. Google API response: {}",
            check_data
        ))
    };

    match upload_result {
        Ok(()) => {
            conn.execute("DELETE FROM backup_metadata WHERE key LIKE 'retry_%'", [])
                .map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                params!["last_backup", &chrono::Utc::now().to_rfc3339()],
            )
            .map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                params!["backup_dirty", "false"],
            )
            .map_err(|e| e.to_string())?;
            log::info!("Google Drive backup upload finished successfully");
            Ok(())
        }
        Err(e) => {
            log::error!("Google Drive backup upload failed: {}", e);
            let new_retry_count = retry_count + 1;
            conn.execute(
                "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                params!["retry_count", &new_retry_count.to_string()],
            )
            .map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                params!["last_error", &e],
            )
            .map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                params!["backup_dirty", "true"],
            )
            .map_err(|e| e.to_string())?;
            Err(e)
        }
    }
}

#[tauri::command]
pub fn clear_retry_metadata(state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM backup_metadata WHERE key LIKE 'retry_%'", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn restore_from_drive(state: tauri::State<DbState>) -> Result<String, String> {
    log::info!("Starting Google Drive restore");
    let access_token = drive_token()?;
    let client = reqwest::blocking::Client::new();

    let check_response = client
        .get("https://www.googleapis.com/drive/v3/files")
        .query(&[
            (
                "q",
                "name='finledger-backup.json' and 'appDataFolder' in parents",
            ),
            ("spaces", "appDataFolder"),
        ])
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .send()
        .map_err(|e| format!("Failed to find file: {}", e))?;

    let check_data: serde_json::Value = check_response
        .json()
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    let files = check_data["files"].as_array().ok_or("No files array")?;
    let file = files.first().ok_or("Backup file not found in Drive")?;
    let file_id = file["id"].as_str().ok_or("Missing file id")?;

    let download_response = client
        .get(&format!(
            "https://www.googleapis.com/drive/v3/files/{}?alt=media",
            file_id
        ))
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .map_err(|e| format!("Failed to download file: {}", e))?;

    if !download_response.status().is_success() {
        return Err(format!(
            "Failed to download file: {}",
            download_response.status()
        ));
    }

    let backup_content = download_response
        .text()
        .map_err(|e| format!("Failed to read file content: {}", e))?;
    let backup: RestoreBackupData = serde_json::from_str(&backup_content)
        .map_err(|e| format!("Failed to parse backup: {}", e))?;

    if backup.version != "1.0" {
        return Err(format!("Incompatible backup version: {}", backup.version));
    }

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM transacoes", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM categorias", [])
        .map_err(|e| e.to_string())?;

    for categoria in &backup.categorias {
        let nome = categoria["nome"].as_str().ok_or("Missing nome")?;
        let tipo = categoria["tipo"].as_str().unwrap_or("despesa");
        let cor = categoria["cor"].as_str().unwrap_or("#94a3b8");
        conn.execute(
            "INSERT INTO categorias (nome, tipo, cor) VALUES (?1, ?2, ?3)",
            params![nome, tipo, cor],
        )
        .map_err(|e| e.to_string())?;
    }

    for transacao in &backup.transacoes {
        let data = transacao["data"].as_str().ok_or("Missing data")?;
        let descricao = transacao["descricao"].as_str().ok_or("Missing descricao")?;
        let valor = transacao["valor"].as_f64().ok_or("Missing valor")?;
        let tipo = transacao["tipo"].as_str().ok_or("Missing tipo")?;
        let categoria = transacao["categoria"].as_str().ok_or("Missing categoria")?;
        let obs = transacao["obs"].as_str().unwrap_or("");
        conn.execute(
            "INSERT INTO transacoes (data, descricao, valor, tipo, categoria, obs) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![data, descricao, valor, tipo, categoria, obs],
        ).map_err(|e| e.to_string())?;
    }

    log::info!(
        "Google Drive restore finished: {} transactions, {} categories",
        backup.transacoes.len(),
        backup.categorias.len()
    );
    Ok(format!(
        "Restaurado: {} transações e {} categorias",
        backup.transacoes.len(),
        backup.categorias.len()
    ))
}
