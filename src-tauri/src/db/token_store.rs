use chrono::Utc;
use iota_stronghold::{Client, Location, procedures::WriteVault};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use tauri_plugin_stronghold::stronghold::Stronghold;
use std::sync::Mutex;

const TOKEN_REFRESH_THRESHOLD_SECS: i64 = 300;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: i64,
}

fn get_or_create_client(vault: &Stronghold) -> Result<Client, String> {
    vault.create_client(b"token-client").map_err(|e| e.to_string())
}

fn read_secret(client: &Client, vault_path: &[u8], record_path: &[u8]) -> Result<Option<String>, String> {
    let store = client.store();
    let location = Location::generic(vault_path.to_vec(), record_path.to_vec());
    let mut key = location.vault_path().to_vec();
    key.extend_from_slice(location.record_path());

    match store.get(&key) {
        Ok(Some(data)) => String::from_utf8(data).map_err(|e| e.to_string()).map(Some),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn write_secret(client: &Client, vault_path: &[u8], record_path: &[u8], value: &str) -> Result<(), String> {
    let location = Location::generic(vault_path.to_vec(), record_path.to_vec());
    let procedure = WriteVault {
        data: value.as_bytes().to_vec().into(),
        location,
    };
    client.execute_procedure(procedure).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_or_create_db_key(vault: &Mutex<Stronghold>) -> Result<String, String> {
    let vault = vault.lock().map_err(|e| e.to_string())?;
    let client = get_or_create_client(&vault)?;

    if let Some(existing_key) = read_secret(&client, b"database", b"sqlcipher_key")? {
        return Ok(existing_key);
    }

    let mut key_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key_bytes);
    let db_key = URL_SAFE_NO_PAD.encode(key_bytes);
    write_secret(&client, b"database", b"sqlcipher_key", &db_key)?;
    vault.save().map_err(|e| e.to_string())?;

    log::info!("[Token Store] SQLCipher database key created in Stronghold");
    Ok(db_key)
}

pub fn store_tokens(vault: &Mutex<Stronghold>, access_token: &str, refresh_token: Option<&str>, expires_in_secs: i64) -> Result<(), String> {
    let vault = vault.lock().map_err(|e| e.to_string())?;
    store_tokens_direct(&vault, access_token, refresh_token, expires_in_secs)
}

pub fn store_tokens_direct(vault: &Stronghold, access_token: &str, refresh_token: Option<&str>, expires_in_secs: i64) -> Result<(), String> {
    let expires_at = Utc::now().timestamp() + expires_in_secs;
    
    let client = get_or_create_client(vault)?;
    write_secret(&client, b"tokens", b"access_token", access_token)?;
    
    if let Some(rt) = refresh_token {
        write_secret(&client, b"tokens", b"refresh_token", rt)?;
    }
    
    write_secret(&client, b"tokens", b"expires_at", &expires_at.to_string())?;
    vault.save().map_err(|e| e.to_string())?;
    
    log::info!("[Token Store] Tokens stored securely, expires at {}", expires_at);
    Ok(())
}

pub fn get_access_token(vault: &Mutex<Stronghold>) -> Result<Option<String>, String> {
    let vault = vault.lock().map_err(|e| e.to_string())?;
    let client = get_or_create_client(&vault)?;
    read_secret(&client, b"tokens", b"access_token")
}

pub fn get_refresh_token(vault: &Mutex<Stronghold>) -> Result<Option<String>, String> {
    let vault = vault.lock().map_err(|e| e.to_string())?;
    let client = get_or_create_client(&vault)?;
    read_secret(&client, b"tokens", b"refresh_token")
}

pub fn get_token_data(vault: &Mutex<Stronghold>) -> Result<Option<TokenData>, String> {
    let access_token = match get_access_token(vault)? {
        Some(t) => t,
        None => return Ok(None),
    };
    
    let refresh_token = get_refresh_token(vault)?;
    
    let vault_guard = vault.lock().map_err(|e| e.to_string())?;
    let client = get_or_create_client(&vault_guard)?;
    
    let expires_at: i64 = read_secret(&client, b"tokens", b"expires_at")?
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);
    
    Ok(Some(TokenData {
        access_token,
        refresh_token,
        expires_at,
    }))
}

pub fn is_token_expired_or_expiring_soon(vault: &Mutex<Stronghold>) -> Result<bool, String> {
    let token_data = get_token_data(vault)?;
    
    match token_data {
        Some(data) => {
            let now = Utc::now().timestamp();
            let remaining = data.expires_at - now;
            let needs_refresh = remaining < TOKEN_REFRESH_THRESHOLD_SECS;
            log::debug!("[Token Store] Token expires in {}s, needs refresh: {}", remaining, needs_refresh);
            Ok(needs_refresh)
        }
        None => {
            log::warn!("[Token Store] No token data found");
            Ok(true)
        }
    }
}

pub fn refresh_access_token(vault: &Mutex<Stronghold>, client_id: &str, client_secret: &str) -> Result<(), String> {
    let refresh_token = match get_refresh_token(vault)? {
        Some(rt) => rt,
        None => return Err("No refresh token available".to_string()),
    };
    
    log::info!("[Token Store] Attempting token refresh...");
    
    let req_client = reqwest::blocking::Client::new();
    let response = req_client.post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("refresh_token", &refresh_token),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .map_err(|e| format!("Failed to refresh token: {}", e))?;
    
    let token_response: serde_json::Value = response.json()
        .map_err(|e| format!("Failed to parse token response: {}", e))?;
    
    let access_token = token_response["access_token"]
        .as_str()
        .ok_or("Missing access_token in refresh response")?;
    
    let new_refresh_token = token_response["refresh_token"].as_str();
    let expires_in_secs: i64 = token_response["expires_in"].as_i64().unwrap_or(3600);
    
    store_tokens(vault, access_token, new_refresh_token, expires_in_secs)?;
    
    Ok(())
}

pub fn get_valid_access_token(vault: &Mutex<Stronghold>, client_id: &str, client_secret: &str) -> Result<String, String> {
    if is_token_expired_or_expiring_soon(vault)? {
        refresh_access_token(vault, client_id, client_secret)?;
    }

    get_access_token(vault)?.ok_or_else(|| "Not connected to Drive".to_string())
}

pub fn clear_tokens(vault: &Mutex<Stronghold>) -> Result<(), String> {
    let vault_guard = vault.lock().map_err(|e| e.to_string())?;
    let client = get_or_create_client(&vault_guard)?;
    let store = client.store();
    
    let locations = [
        Location::generic(b"tokens".to_vec(), b"access_token".to_vec()),
        Location::generic(b"tokens".to_vec(), b"refresh_token".to_vec()),
        Location::generic(b"tokens".to_vec(), b"expires_at".to_vec()),
    ];
    
    for loc in locations {
        let mut key = loc.vault_path().to_vec();
        key.extend_from_slice(loc.record_path());
        let _ = store.delete(&key);
    }
    
    vault_guard.save().ok();
    
    log::info!("[Token Store] Tokens cleared from vault");
    Ok(())
}
