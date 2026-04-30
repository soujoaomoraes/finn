use rusqlite::params;
use serde::{Deserialize, Serialize};
use crate::db::DbState;

#[derive(Debug, Serialize, Deserialize)]
pub struct Transacao {
    pub id: Option<i64>,
    pub descricao: String,
    pub valor: f64,
    pub data: String,
    pub tipo: String,
    pub categoria: String,
    pub obs: String,
}

#[tauri::command]
pub fn get_all_transacoes(state: tauri::State<DbState>) -> Result<Vec<Transacao>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, descricao, valor, data, tipo, categoria, obs FROM transacoes ORDER BY data DESC").map_err(|e| e.to_string())?;
    
    let transacoes = stmt.query_map([], |row| {
        Ok(Transacao {
            id: row.get(0)?,
            descricao: row.get(1)?,
            valor: row.get(2)?,
            data: row.get(3)?,
            tipo: row.get(4)?,
            categoria: row.get(5)?,
            obs: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(transacoes)
}

#[tauri::command]
pub fn save_transacao(transacao: Transacao, state: tauri::State<DbState>) -> Result<i64, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    match transacao.id {
        Some(id) if id > 0 => {
            conn.execute(
                "UPDATE transacoes SET descricao = ?1, valor = ?2, data = ?3, tipo = ?4, categoria = ?5, obs = ?6 WHERE id = ?7",
                params![transacao.descricao, transacao.valor, transacao.data, transacao.tipo, transacao.categoria, transacao.obs, id],
            ).map_err(|e| e.to_string())?;
            Ok(id)
        }
        _ => {
            conn.execute(
                "INSERT INTO transacoes (descricao, valor, data, tipo, categoria, obs) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![transacao.descricao, transacao.valor, transacao.data, transacao.tipo, transacao.categoria, transacao.obs],
            ).map_err(|e| e.to_string())?;
            Ok(conn.last_insert_rowid())
        }
    }
}

#[tauri::command]
pub fn delete_transacao(id: i64, state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM transacoes WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}
