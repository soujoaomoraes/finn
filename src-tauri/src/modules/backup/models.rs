use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct BackupData {
    pub version: String,
    pub exported_at: String,
    pub transacoes: Vec<serde_json::Value>,
    pub categorias: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct RestoreBackupData {
    pub version: String,
    #[allow(dead_code)]
    pub exported_at: String,
    pub transacoes: Vec<serde_json::Value>,
    pub categorias: Vec<serde_json::Value>,
}