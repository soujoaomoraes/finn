use crate::db::{token_store, DbState};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::Rng;
use rusqlite::Connection;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::{Emitter, Manager};
use url::Url;

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

#[derive(Debug)]
struct TokenExchange {
    access_token: String,
    refresh_token: Option<String>,
    expires_in_secs: i64,
}

fn get_client_id() -> &'static str {
    env!("GOOGLE_CLIENT_ID")
}

fn get_client_secret() -> &'static str {
    env!("GOOGLE_CLIENT_SECRET")
}

#[tauri::command]
pub fn connect_google_drive(
    app_handle: tauri::AppHandle,
    state: tauri::State<DbState>,
) -> Result<String, String> {
    let mut rng = rand::thread_rng();

    let code_verifier: String = (0..32)
        .map(|_| {
            let chars = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
            chars[rng.gen_range(0..chars.len())] as char
        })
        .collect();

    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());

    let oauth_state: String = (0..16)
        .map(|_| {
            let chars = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            chars[rng.gen_range(0..chars.len())] as char
        })
        .collect();

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
        rusqlite::params!["oauth_code_verifier", &code_verifier],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
        rusqlite::params!["oauth_state", &oauth_state],
    )
    .map_err(|e| e.to_string())?;

    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind loopback: {}", e))?;
    let local_port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{}", local_port);
    let redirect_uri_clone = redirect_uri.clone();
    let app_handle_clone = app_handle.clone();

    std::thread::spawn(move || {
        for stream_result in listener.incoming() {
            let Ok(mut stream) = stream_result else {
                continue;
            };

            let mut buf = [0u8; 4096];
            let Ok(size) = stream.read(&mut buf) else {
                continue;
            };

            if size == 0 {
                continue;
            }

            let req = String::from_utf8_lossy(&buf[..size]);
            let Some(line) = req.lines().next() else {
                continue;
            };

            if !line.starts_with("GET ") {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 2 {
                continue;
            }

            let path = parts[1];
            if path.contains("favicon.ico") {
                let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\n\r\n");
                continue;
            }

            let Ok(parsed) = Url::parse(&format!("http://localhost{}", path)) else {
                continue;
            };

            let mut code_opt: Option<String> = None;
            let mut state_opt: Option<String> = None;
            for (key, value) in parsed.query_pairs() {
                if key == "code" {
                    code_opt = Some(value.to_string());
                }
                if key == "state" {
                    state_opt = Some(value.to_string());
                }
            }

            let (Some(code), Some(state_param)) = (code_opt, state_opt) else {
                continue;
            };

            let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<html><head><title>Sucesso</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f8fafc;color:#0f172a;text-align:center;}</style></head><body><div><h1 style='color:#10b981;'>Autorização recebida!</h1><p>Você já pode fechar esta aba e voltar para o aplicativo.</p></div></body></html>";
            let _ = stream.write_all(response.as_bytes());
            let _ = stream.flush();

            let db_state = app_handle_clone.state::<DbState>();
            match db_state
                .conn
                .lock()
                .map_err(|e| e.to_string())
                .and_then(|conn| {
                    let token = exchange_code_for_token_with_conn(
                        &conn,
                        code.clone(),
                        state_param.clone(),
                        &redirect_uri_clone,
                    )?;
                    token_store::store_tokens(
                        &db_state.vault,
                        &token.access_token,
                        token.refresh_token.as_deref(),
                        token.expires_in_secs,
                    )?;
                    conn.execute(
                        "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                        rusqlite::params!["drive_connected", "true"],
                    )
                    .map_err(|e| e.to_string())?;
                    conn.execute(
                        "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                        rusqlite::params!["last_error", ""],
                    )
                    .map_err(|e| e.to_string())?;
                    conn.execute(
                        "DELETE FROM backup_metadata WHERE key IN ('drive_access_token', 'drive_refresh_token')",
                        [],
                    )
                    .map_err(|e| e.to_string())?;
                    Ok(())
                }) {
                Ok(()) => log::info!("Google Drive OAuth completed successfully"),
                Err(error) => {
                    log::error!("Google Drive OAuth failed: {}", error);
                    if let Ok(conn) = db_state.conn.lock() {
                        let _ = conn.execute(
                            "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                            rusqlite::params!["last_error", &error],
                        );
                        let _ = conn.execute(
                            "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
                            rusqlite::params!["drive_connected", "false"],
                        );
                    }
                }
            }

            let _ = app_handle_clone.emit("oauth_callback", ());
            break;
        }
    });

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

fn exchange_code_for_token_inner(
    code: String,
    state_param: String,
    conn: &Connection,
    redirect_uri: &str,
) -> Result<TokenExchange, String> {
    let stored_state: Option<String> = conn
        .query_row(
            "SELECT value FROM backup_metadata WHERE key = ?1",
            rusqlite::params!["oauth_state"],
            |row| row.get(0),
        )
        .ok();

    if stored_state != Some(state_param) {
        return Err("Invalid state parameter".to_string());
    }

    let code_verifier: Option<String> = conn
        .query_row(
            "SELECT value FROM backup_metadata WHERE key = ?1",
            rusqlite::params!["oauth_code_verifier"],
            |row| row.get(0),
        )
        .ok();

    let code_verifier = code_verifier.ok_or("Code verifier not found")?;

    let client = reqwest::blocking::Client::new();
    let response = client
        .post(TOKEN_URL)
        .form(&[
            ("client_id", get_client_id()),
            ("client_secret", get_client_secret()),
            ("code", &code),
            ("code_verifier", &code_verifier),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .map_err(|e| format!("Failed to exchange code: {}", e))?;

    let token_response: serde_json::Value = response
        .json()
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let access_token = token_response["access_token"].as_str().ok_or_else(|| {
        let err_msg = token_response["error_description"]
            .as_str()
            .or_else(|| token_response["error"].as_str())
            .unwrap_or("Unknown error");
        format!("Google OAuth Error: {}", err_msg)
    })?;

    let refresh_token = token_response["refresh_token"].as_str().map(str::to_string);
    let expires_in_secs = token_response["expires_in"].as_i64().unwrap_or(3600);

    Ok(TokenExchange {
        access_token: access_token.to_string(),
        refresh_token,
        expires_in_secs,
    })
}

fn exchange_code_for_token_with_conn(
    conn: &Connection,
    code: String,
    state_param: String,
    redirect_uri: &str,
) -> Result<TokenExchange, String> {
    exchange_code_for_token_inner(code, state_param, conn, redirect_uri)
}

#[tauri::command]
pub fn disconnect_google_drive(state: tauri::State<DbState>) -> Result<(), String> {
    token_store::clear_tokens(&state.vault)?;

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM backup_metadata WHERE key LIKE 'drive_%'", [])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?1, ?2)",
        rusqlite::params!["drive_connected", "false"],
    )
    .map_err(|e| e.to_string())?;

    log::info!("Google Drive disconnected");
    Ok(())
}

#[tauri::command]
pub fn is_drive_connected(state: tauri::State<DbState>) -> Result<bool, String> {
    token_store::get_access_token(&state.vault).map(|token| token.is_some())
}
