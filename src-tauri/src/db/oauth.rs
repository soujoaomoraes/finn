use rand::Rng;
use sha2::{Digest, Sha256};
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Serialize};
use crate::db::DbState;
use std::net::TcpListener;
use std::io::{Read, Write};
use url::Url;
use rusqlite::Connection;
use tauri::Emitter;

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const REDIRECT_URI: &str = "http://localhost:8080"; // Para desktop apps

fn get_client_id() -> &'static str {
    env!("GOOGLE_CLIENT_ID")
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
    pub email: Option<String>,
}

#[tauri::command]
pub fn connect_google_drive(app_handle: tauri::AppHandle, state: tauri::State<DbState>) -> Result<String, String> {
    let mut rng = rand::thread_rng();
    
    // Generate code verifier
    let code_verifier: String = (0..32)
        .map(|_| {
            let chars = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
            chars[rng.gen_range(0..chars.len())] as char
        })
        .collect();
    
    // Generate code challenge (SHA256 hash, base64url encoded)
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());
    
    // Generate state for security
    let oauth_state: String = (0..16)
        .map(|_| {
            let chars = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            chars[rng.gen_range(0..chars.len())] as char
        })
        .collect();
    
    // Store code_verifier and state for later verification
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
        rusqlite::params!["oauth_code_verifier", &code_verifier],
    ).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
        rusqlite::params!["oauth_state", &oauth_state],
    ).map_err(|e| e.to_string())?;

    // Start a loopback listener on an ephemeral port and spawn a thread to handle the callback
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Failed to bind loopback: {}", e))?;
    let local_port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{}", local_port);

    // To allow the background thread to store tokens, extract the DB file path from the current connection
    let db_file: String = conn.query_row("PRAGMA database_list", [], |row| row.get::<_, String>(2)).unwrap_or_else(|_| ":memory:".to_string());

    // Clone necessary values for thread
    let db_file_clone = db_file.clone();
    let redirect_uri_clone = redirect_uri.clone();
    let oauth_state_clone = oauth_state.clone();
    let app_handle_clone = app_handle.clone();

    std::thread::spawn(move || {
        // loop until we find the actual oauth callback with 'code'
        for stream_result in listener.incoming() {
            if let Ok(mut stream) = stream_result {
                let mut buf = [0u8; 4096];
                if let Ok(size) = stream.read(&mut buf) {
                    if size == 0 { continue; }
                    let req = String::from_utf8_lossy(&buf[..size]);
                    if let Some(line) = req.lines().next() {
                        if line.starts_with("GET ") {
                            let parts: Vec<&str> = line.split_whitespace().collect();
                            if parts.len() >= 2 {
                                let path = parts[1];
                                
                                // Ignore favicon or generic requests without killing the listener
                                if path.contains("favicon.ico") {
                                    let response = "HTTP/1.1 404 Not Found\r\n\r\n";
                                    let _ = stream.write(response.as_bytes());
                                    continue;
                                }

                                if let Ok(parsed) = Url::parse(&format!("http://localhost{}", path)) {
                                    let mut code_opt: Option<String> = None;
                                    let mut state_opt: Option<String> = None;
                                    for (k, v) in parsed.query_pairs() {
                                        if k == "code" { code_opt = Some(v.to_string()); }
                                        if k == "state" { state_opt = Some(v.to_string()); }
                                    }

                                    if let (Some(code), Some(state_param)) = (code_opt, state_opt) {
                                        
                                        // RESPONDER IMEDIATAMENTE PARA O NAVEGADOR PARAR DE CARREGAR
                                        let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<html><head><title>Sucesso</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f8fafc;color:#0f172a;text-align:center;}</style></head><body><div><h1 style='color:#10b981;'>✓ Autorização recebida!</h1><p>Você já pode fechar esta aba e voltar para o aplicativo.</p></div></body></html>";
                                        let _ = stream.write(response.as_bytes());
                                        let _ = stream.flush();

                                        // attempt exchange using a fresh DB connection
                                        if let Ok(conn2) = Connection::open(&db_file_clone) {
                                            match exchange_code_for_token_with_conn(&conn2, code.clone(), state_param.clone(), &redirect_uri_clone) {
                                                Ok(_) => {
                                                    let _ = conn2.execute("INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)", rusqlite::params!["drive_connected", "true"]);
                                                    let _ = conn2.execute("INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)", rusqlite::params!["last_error", ""]);
                                                }
                                                Err(e) => {
                                                    eprintln!("\n[OAuth Backend Error] Falha geral na troca do token: {}\n", e);
                                                    let _ = conn2.execute("INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)", rusqlite::params!["last_error", &e]);
                                                    let _ = conn2.execute("INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)", rusqlite::params!["drive_connected", "false"]);
                                                }
                                            }
                                        }

                                        let _ = app_handle_clone.emit("oauth_callback", ());
                                        
                                        // Successfully handled the callback, break the loop and end the thread
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    // Build authorization URL using the dynamic redirect URI
    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&code_challenge={}&code_challenge_method=S256&state={}&prompt=consent",
        AUTH_URL,
        get_client_id(),
        redirect_uri,
        "https://www.googleapis.com/auth/drive.appdata",
        code_challenge,
        oauth_state
    );

    Ok(auth_url)
}

// Internal helper to perform the token exchange; kept separate so the loopback listener can call it
fn exchange_code_for_token_inner(code: String, state_param: String, conn: &Connection, redirect_uri: &str) -> Result<(), String> {
    // Verify state
    let stored_state: Option<String> = conn.query_row(
        "SELECT value FROM backup_metadata WHERE key = ?1",
        rusqlite::params!["oauth_state"],
        |row| row.get(0),
    ).ok();

    if stored_state != Some(state_param) {
        return Err("Invalid state parameter".to_string());
    }

    // Get code verifier
    let code_verifier: Option<String> = conn.query_row(
        "SELECT value FROM backup_metadata WHERE key = ?1",
        rusqlite::params!["oauth_code_verifier"],
        |row| row.get(0),
    ).ok();

    let code_verifier = code_verifier.ok_or("Code verifier not found")?;

    // Exchange code for token
    let client = reqwest::blocking::Client::new();
    let response = client.post(TOKEN_URL)
        .form(&[
            ("client_id", get_client_id()),
            ("client_secret", env!("GOOGLE_CLIENT_SECRET")),
            ("code", &code),
            ("code_verifier", &code_verifier),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .map_err(|e| format!("Failed to exchange code: {}", e))?;

    let token_response: serde_json::Value = response.json().map_err(|e| format!("Failed to parse response: {}", e))?;

    let access_token = token_response["access_token"]
        .as_str()
        .ok_or_else(|| {
            let err_msg = token_response["error_description"]
                .as_str()
                .or_else(|| token_response["error"].as_str())
                .unwrap_or("Unknown error");
            let full_err = format!("Google OAuth Error: {}", err_msg);
            eprintln!("\n[OAuth Backend Error] Falha na troca do token: {}\n", full_err);
            full_err
        })?;

    let refresh_token = token_response["refresh_token"].as_str();

    // Store tokens
    conn.execute(
        "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
        rusqlite::params!["drive_access_token", access_token],
    ).map_err(|e| e.to_string())?;

    if let Some(rt) = refresh_token {
        conn.execute(
            "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
            rusqlite::params!["drive_refresh_token", rt],
        ).map_err(|e| e.to_string())?;
    }

    conn.execute(
        "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
        rusqlite::params!["drive_connected", "true"],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

fn exchange_code_for_token_with_conn(conn: &Connection, code: String, state_param: String, redirect_uri: &str) -> Result<(), String> {
    exchange_code_for_token_inner(code, state_param, conn, redirect_uri)
}

#[tauri::command]
pub fn exchange_code_for_token(code: String, state_param: String, state: tauri::State<DbState>) -> Result<(), String> {
    // Backwards-compatible command; uses the current DB connection to get DB path and open a new connection
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let db_file: String = conn.query_row("PRAGMA database_list", [], |row| row.get::<_, String>(2)).unwrap_or_else(|_| ":memory:".to_string());
    drop(conn);
    let conn2 = Connection::open(db_file).map_err(|e| e.to_string())?;
    exchange_code_for_token_with_conn(&conn2, code, state_param, "http://localhost:8080")
}

#[tauri::command]
pub fn disconnect_google_drive(state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    // Remove tokens
    conn.execute("DELETE FROM backup_metadata WHERE key LIKE 'drive_%'", [])
        .map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
        rusqlite::params!["drive_connected", "false"],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn is_drive_connected(state: tauri::State<DbState>) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let connected: Option<String> = conn.query_row(
        "SELECT value FROM backup_metadata WHERE key = ?1",
        rusqlite::params!["drive_connected"],
        |row| row.get(0),
    ).ok();
    
    Ok(connected == Some("true".to_string()))
}

#[derive(Debug, Serialize)]
struct BackupData {
    version: String,
    exported_at: String,
    transacoes: Vec<serde_json::Value>,
    categorias: Vec<serde_json::Value>,
}

#[tauri::command]
pub fn upload_backup_to_drive(state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    // Check retry metadata
    let retry_count: Option<String> = conn.query_row(
        "SELECT value FROM backup_metadata WHERE key = ?1",
        rusqlite::params!["retry_count"],
        |row| row.get(0),
    ).ok();
    
    let retry_count: u32 = retry_count.and_then(|s| s.parse().ok()).unwrap_or(0);
    
    // Calculate exponential backoff delay (1s, 2s, 4s, 8s, max 60s)
    let delay_ms = if retry_count == 0 {
        0
    } else {
        let base_delay = 1000u64;
        let max_delay = 60000u64;
        let delay = base_delay * 2u64.pow(retry_count.min(5));
        delay.min(max_delay)
    };
    
    if delay_ms > 0 {
        std::thread::sleep(std::time::Duration::from_millis(delay_ms));
    }
    
    // Get access token
    let access_token: Option<String> = conn.query_row(
        "SELECT value FROM backup_metadata WHERE key = ?1",
        rusqlite::params!["drive_access_token"],
        |row| row.get(0),
    ).ok();
    
    let access_token = access_token.ok_or("Not connected to Drive")?;
    
    // Get all transactions
    let mut transacoes = Vec::new();
    let mut stmt = conn.prepare("SELECT id, data, descricao, valor, tipo, categoria, obs FROM transacoes ORDER BY data DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "data": row.get::<_, String>(1)?,
            "descricao": row.get::<_, String>(2)?,
            "valor": row.get::<_, f64>(3)?,
            "tipo": row.get::<_, String>(4)?,
            "categoria": row.get::<_, String>(5)?,
            "obs": row.get::<_, String>(6)?,
        }))
    }).map_err(|e| e.to_string())?;
    
    for row in rows {
        transacoes.push(row.map_err(|e| e.to_string())?);
    }
    
    // Get all categories
    let mut categorias = Vec::new();
    let mut stmt = conn.prepare("SELECT nome, tipo, cor FROM categorias ORDER BY nome")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "nome": row.get::<_, String>(0)?,
            "tipo": row.get::<_, String>(1)?,
            "cor": row.get::<_, String>(2)?,
        }))
    }).map_err(|e| e.to_string())?;
    
    for row in rows {
        categorias.push(row.map_err(|e| e.to_string())?);
    }
    
    // Create backup data
    let backup = BackupData {
        version: "1.0".to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        transacoes,
        categorias,
    };
    
    let backup_json = serde_json::to_string(&backup).map_err(|e| e.to_string())?;
    
    // Upload to Drive appDataFolder
    let client = reqwest::blocking::Client::new();
    
    // Check if file exists
    let check_response = client.get("https://www.googleapis.com/drive/v3/files")
        .query(&[
            ("q", "name='finledger-backup.json' and 'appDataFolder' in parents"),
            ("spaces", "appDataFolder")
        ])
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .send()
        .map_err(|e| format!("Failed to check file: {}", e))?;
    
    let check_data: serde_json::Value = check_response.json().map_err(|e| format!("Failed to parse check response: {}", e))?;
    
    let upload_result = if let Some(files) = check_data["files"].as_array() {
        if !files.is_empty() {
            // Update existing file
            let file_id = files[0]["id"].as_str().ok_or("Missing file id")?;
            
            let update_response = client.patch(&format!("https://www.googleapis.com/upload/drive/v3/files/{}?uploadType=media", file_id))
                .header("Authorization", format!("Bearer {}", access_token))
                .header("Content-Type", "application/json")
                .body(backup_json)
                .send()
                .map_err(|e| format!("Failed to update file: {}", e))?;
            
            if !update_response.status().is_success() {
                Err(format!("Failed to update file: {}", update_response.status()))
            } else {
                Ok(())
            }
        } else {
            // Create new file using simple upload
            let metadata = serde_json::json!({
                "name": "finledger-backup.json",
                "parents": ["appDataFolder"]
            });
            
            let create_response = client.post("https://www.googleapis.com/drive/v3/files")
                .header("Authorization", format!("Bearer {}", access_token))
                .header("Content-Type", "application/json; charset=UTF-8")
                .json(&metadata)
                .send()
                .map_err(|e| format!("Failed to create file metadata: {}", e))?;
            
            if !create_response.status().is_success() {
                Err(format!("Failed to create file metadata: {}", create_response.status()))
            } else {
                let file_data: serde_json::Value = create_response.json().map_err(|e| format!("Failed to parse file data: {}", e))?;
                let file_id = file_data["id"].as_str().ok_or("Missing file id")?;
                
                // Upload content
                let upload_response = client.patch(&format!("https://www.googleapis.com/upload/drive/v3/files/{}?uploadType=media", file_id))
                    .header("Authorization", format!("Bearer {}", access_token))
                    .header("Content-Type", "application/json")
                    .body(backup_json)
                    .send()
                    .map_err(|e| format!("Failed to upload content: {}", e))?;
                
                if !upload_response.status().is_success() {
                    Err(format!("Failed to upload content: {}", upload_response.status()))
                } else {
                    Ok(())
                }
            }
        }
    } else {
        Err(format!("Failed to check files. Google API response: {}", check_data.to_string()))
    };
    
    match upload_result {
        Ok(_) => {
            // Success - clear retry metadata
            conn.execute("DELETE FROM backup_metadata WHERE key LIKE 'retry_%'", [])
                .map_err(|e| e.to_string())?;
            
            conn.execute(
                "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                rusqlite::params!["last_backup", &chrono::Utc::now().to_rfc3339()],
            ).map_err(|e| e.to_string())?;
            
            conn.execute(
                "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                rusqlite::params!["backup_dirty", "false"],
            ).map_err(|e| e.to_string())?;
            
            Ok(())
        }
        Err(e) => {
            eprintln!("\n[Backup Error] Falha ao fazer o upload para o Drive: {}\n", e);
            
            // Failure - increment retry count and store error
            let new_retry_count = retry_count + 1;
            conn.execute(
                "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                rusqlite::params!["retry_count", &new_retry_count.to_string()],
            ).map_err(|e| e.to_string())?;
            
            conn.execute(
                "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                rusqlite::params!["last_error", &e],
            ).map_err(|e| e.to_string())?;
            
            conn.execute(
                "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                rusqlite::params!["backup_dirty", "true"],
            ).map_err(|e| e.to_string())?;
            
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

#[derive(Debug, Deserialize)]
struct RestoreBackupData {
    version: String,
    exported_at: String,
    transacoes: Vec<serde_json::Value>,
    categorias: Vec<serde_json::Value>,
}

#[tauri::command]
pub fn restore_from_drive(state: tauri::State<DbState>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    // Get access token
    let access_token: Option<String> = conn.query_row(
        "SELECT value FROM backup_metadata WHERE key = ?1",
        rusqlite::params!["drive_access_token"],
        |row| row.get(0),
    ).ok();
    
    let access_token = access_token.ok_or("Not connected to Drive")?;
    
    // Drop the lock before starting transaction
    drop(conn);
    
    // Download backup from Drive
    let client = reqwest::blocking::Client::new();
    
    // Find backup file
    let check_response = client.get("https://www.googleapis.com/drive/v3/files")
        .query(&[
            ("q", "name='finledger-backup.json' and 'appDataFolder' in parents"),
            ("spaces", "appDataFolder")
        ])
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .send()
        .map_err(|e| format!("Failed to find file: {}", e))?;
    
    let check_data: serde_json::Value = check_response.json().map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let files = check_data["files"].as_array().ok_or("No files array")?;
    let file = files.first().ok_or("Backup file not found in Drive")?;
    let file_id = file["id"].as_str().ok_or("Missing file id")?;
    
    // Download file content
    let download_response = client.get(&format!("https://www.googleapis.com/drive/v3/files/{}?alt=media", file_id))
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .map_err(|e| format!("Failed to download file: {}", e))?;
    
    if !download_response.status().is_success() {
        return Err(format!("Failed to download file: {}", download_response.status()));
    }
    
    let backup_content = download_response.text().map_err(|e| format!("Failed to read file content: {}", e))?;
    
    // Parse backup
    let backup: RestoreBackupData = serde_json::from_str(&backup_content)
        .map_err(|e| format!("Failed to parse backup: {}", e))?;
    
    // Validate version
    if backup.version != "1.0" {
        return Err(format!("Incompatible backup version: {}", backup.version));
    }
    
    // Clear existing data transactionally
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    conn.execute("DELETE FROM transacoes", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM categorias", []).map_err(|e| e.to_string())?;
    
    // Restore categories
    for categoria in &backup.categorias {
        let nome = categoria["nome"].as_str().ok_or("Missing nome")?;
        let tipo = categoria["tipo"].as_str().unwrap_or("despesa");
        let cor = categoria["cor"].as_str().unwrap_or("#94a3b8");
        
        conn.execute(
            "INSERT INTO categorias (nome, tipo, cor) VALUES (?1, ?2, ?3)",
            rusqlite::params![nome, tipo, cor],
        ).map_err(|e| e.to_string())?;
    }
    
    // Restore transactions
    for transacao in &backup.transacoes {
        let data = transacao["data"].as_str().ok_or("Missing data")?;
        let descricao = transacao["descricao"].as_str().ok_or("Missing descricao")?;
        let valor = transacao["valor"].as_f64().ok_or("Missing valor")?;
        let tipo = transacao["tipo"].as_str().ok_or("Missing tipo")?;
        let categoria = transacao["categoria"].as_str().ok_or("Missing categoria")?;
        let obs = transacao["obs"].as_str().unwrap_or("");
        
        conn.execute(
            "INSERT INTO transacoes (data, descricao, valor, tipo, categoria, obs) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![data, descricao, valor, tipo, categoria, obs],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(format!("Restaurado: {} transações e {} categorias", backup.transacoes.len(), backup.categorias.len()))
}
