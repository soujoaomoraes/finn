use rusqlite::params;
use serde::{Deserialize, Serialize};
use crate::infrastructure::db::DbState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transacao {
    pub id: Option<i64>,
    pub descricao: String,
    pub valor: f64,
    pub data: String,
    pub tipo: String,
    pub categoria: String,
    pub obs: String,
    pub recorrente_id: Option<i64>,
}

impl Default for Transacao {
    fn default() -> Self {
        Self {
            id: None,
            descricao: "".to_string(),
            valor: 0.0,
            data: "2026-01-01".to_string(),
            tipo: "despesa".to_string(),
            categoria: "".to_string(),
            obs: "".to_string(),
            recorrente_id: None,
        }
    }
}

#[allow(dead_code)]
pub fn save_transacao_internal(conn: &rusqlite::Connection, transacao: &Transacao) -> Result<i64, String> {
    match transacao.id {
        Some(id) if id > 0 => {
            conn.execute(
                "UPDATE transacoes SET descricao = ?1, valor = ?2, data = ?3, tipo = ?4, categoria = ?5, obs = ?6, recorrente_id = ?7 WHERE id = ?8",
                params![&transacao.descricao, transacao.valor, &transacao.data, &transacao.tipo, &transacao.categoria, &transacao.obs, transacao.recorrente_id, id],
            ).map_err(|e| e.to_string())?;
            Ok(id)
        }
        _ => {
            conn.execute(
                "INSERT INTO transacoes (descricao, valor, data, tipo, categoria, obs, recorrente_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![&transacao.descricao, transacao.valor, &transacao.data, &transacao.tipo, &transacao.categoria, &transacao.obs, transacao.recorrente_id],
            ).map_err(|e| e.to_string())?;
            Ok(conn.last_insert_rowid())
        }
    }
}

#[allow(dead_code)]
pub fn delete_transacao_internal(conn: &rusqlite::Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM transacoes WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_all_transacoes(state: tauri::State<DbState>) -> Result<Vec<Transacao>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, descricao, valor, data, tipo, categoria, obs, recorrente_id FROM transacoes ORDER BY data DESC").map_err(|e| e.to_string())?;

    let transacoes = stmt.query_map([], |row| {
        Ok(Transacao {
            id: row.get(0)?,
            descricao: row.get(1)?,
            valor: row.get(2)?,
            data: row.get(3)?,
            tipo: row.get(4)?,
            categoria: row.get(5)?,
            obs: row.get(6)?,
            recorrente_id: row.get(7)?,
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
                "UPDATE transacoes SET descricao = ?1, valor = ?2, data = ?3, tipo = ?4, categoria = ?5, obs = ?6, recorrente_id = ?7 WHERE id = ?8",
                params![transacao.descricao, transacao.valor, transacao.data, transacao.tipo, transacao.categoria, transacao.obs, transacao.recorrente_id, id],
            ).map_err(|e| e.to_string())?;
            Ok(id)
        }
        _ => {
            conn.execute(
                "INSERT INTO transacoes (descricao, valor, data, tipo, categoria, obs, recorrente_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![transacao.descricao, transacao.valor, transacao.data, transacao.tipo, transacao.categoria, transacao.obs, transacao.recorrente_id],
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


#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::db::test_utils::test_db_connection;

    fn setup_test_conn() -> rusqlite::Connection {
        test_db_connection().unwrap()
    }

    #[test]
    fn test_save_transacao_insert() {
        let conn = setup_test_conn();
        let transacao = Transacao {
            id: None,
            descricao: "Mercado".to_string(),
            valor: 150.00,
            data: "2026-05-15".to_string(),
            tipo: "despesa".to_string(),
            categoria: "Alimentação".to_string(),
            obs: "".to_string(),
            recorrente_id: None,
        };

        let id = save_transacao_internal(&conn, &transacao).unwrap();
        assert!(id > 0);
    }

    #[test]
    fn test_save_transacao_update() {
        let conn = setup_test_conn();

        let transacao = Transacao {
            id: None,
            descricao: "Mercado".to_string(),
            valor: 150.00,
            data: "2026-05-15".to_string(),
            tipo: "despesa".to_string(),
            categoria: "Alimentação".to_string(),
            obs: "".to_string(),
            recorrente_id: None,
        };

        let id = save_transacao_internal(&conn, &transacao).unwrap();

        let updated = Transacao {
            id: Some(id),
            descricao: "Mercado atualizado".to_string(),
            valor: 200.00,
            ..Default::default()
        };

        let result = save_transacao_internal(&conn, &updated).unwrap();
        assert_eq!(result, id);
    }

     #[test]
     fn test_delete_transacao() {
         let conn = setup_test_conn();

         let transacao = Transacao {
             id: None,
             descricao: "Teste".to_string(),
             valor: 50.00,
             data: "2026-05-15".to_string(),
             tipo: "despesa".to_string(),
             categoria: "Alimentação".to_string(),
             obs: "".to_string(),
             recorrente_id: None,
         };

         let id = save_transacao_internal(&conn, &transacao).unwrap();
         delete_transacao_internal(&conn, id).unwrap();

         let count: i64 = conn.query_row("SELECT COUNT(*) FROM transacoes WHERE id = ?1", params![id], |r| r.get(0)).unwrap_or(0);
         assert_eq!(count, 0);
     }
 }

 pub mod export;
