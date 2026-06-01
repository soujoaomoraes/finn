use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::Utc;
use keyring::Entry;
use rand::RngCore;

const SERVICE: &str = "finledger";
const TOKEN_REFRESH_THRESHOLD_SECS: i64 = 300;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: i64,
}

fn entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, key).map_err(|e| e.to_string())
}

fn read(key: &str) -> Result<Option<String>, String> {
    match entry(key)?.get_password() {
        Ok(val) => Ok(Some(val)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn write(key: &str, value: &str) -> Result<(), String> {
    entry(key)?.set_password(value).map_err(|e| e.to_string())
}

fn delete(key: &str) -> Result<(), String> {
    match entry(key)?.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn get_or_create_db_key() -> Result<String, String> {
    if let Some(existing) = read("sqlcipher_key")? {
        return Ok(existing);
    }

    let mut key_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key_bytes);
    let db_key = URL_SAFE_NO_PAD.encode(key_bytes);
    write("sqlcipher_key", &db_key)?;

    log::info!("[Token Store] SQLCipher database key created in keyring");
    Ok(db_key.to_string())
}

pub fn store_tokens(
    access_token: &str,
    refresh_token: Option<&str>,
    expires_in_secs: i64,
) -> Result<(), String> {
    let expires_at = Utc::now().timestamp() + expires_in_secs;

    write("access_token", access_token)?;

    if let Some(rt) = refresh_token {
        write("refresh_token", rt)?;
    }

    write("expires_at", &expires_at.to_string())?;

    log::info!(
        "[Token Store] Tokens stored in keyring, expires at {}",
        expires_at
    );
    Ok(())
}

pub fn get_access_token() -> Result<Option<String>, String> {
    read("access_token")
}

pub fn get_refresh_token() -> Result<Option<String>, String> {
    read("refresh_token")
}

pub fn get_token_data() -> Result<Option<TokenData>, String> {
    let access_token = match read("access_token")? {
        Some(t) => t,
        None => return Ok(None),
    };

    let refresh_token = read("refresh_token")?;

    let expires_at: i64 = read("expires_at")?
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    Ok(Some(TokenData {
        access_token,
        refresh_token,
        expires_at,
    }))
}

pub fn is_token_expired_or_expiring_soon() -> Result<bool, String> {
    match get_token_data()? {
        Some(data) => {
            let now = Utc::now().timestamp();
            let remaining = data.expires_at - now;
            let needs_refresh = remaining < TOKEN_REFRESH_THRESHOLD_SECS;
            log::debug!(
                "[Token Store] Token expires in {}s, needs refresh: {}",
                remaining,
                needs_refresh
            );
            Ok(needs_refresh)
        }
        None => {
            log::warn!("[Token Store] No token data found");
            Ok(true)
        }
    }
}

pub fn refresh_access_token(client_id: &str, client_secret: &str) -> Result<(), String> {
    let refresh_token = match get_refresh_token()? {
        Some(rt) => rt,
        None => return Err("No refresh token available".to_string()),
    };

    log::info!("[Token Store] Attempting token refresh...");

    let req_client = reqwest::blocking::Client::new();
    let response = req_client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("refresh_token", &refresh_token),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .map_err(|e| format!("Failed to refresh token: {}", e))?;

    let token_response: serde_json::Value = response
        .json()
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    let access_token = token_response["access_token"]
        .as_str()
        .ok_or("Missing access_token in refresh response")?;

    let new_refresh_token = token_response["refresh_token"].as_str();
    let expires_in_secs: i64 = token_response["expires_in"].as_i64().unwrap_or(3600);

    store_tokens(access_token, new_refresh_token, expires_in_secs)?;

    log::info!("[Token Store] Token refreshed successfully");
    Ok(())
}

pub fn get_valid_access_token(client_id: &str, client_secret: &str) -> Result<String, String> {
    if is_token_expired_or_expiring_soon()? {
        refresh_access_token(client_id, client_secret)?;
    }

    get_access_token()?.ok_or_else(|| "Not connected to Drive".to_string())
}

pub fn clear_tokens() -> Result<(), String> {
    delete("access_token")?;
    delete("refresh_token")?;
    delete("expires_at")?;

    log::info!("[Token Store] Tokens cleared from keyring");
    Ok(())
}
