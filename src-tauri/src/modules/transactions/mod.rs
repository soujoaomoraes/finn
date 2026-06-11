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
    pub reserva_id: Option<i64>,
    pub reserva_nome: Option<String>,
    #[serde(default)]
    pub is_transferencia: i64,
    pub transferencia_par_id: Option<i64>,
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
            reserva_id: None,
            reserva_nome: None,
            is_transferencia: 0,
            transferencia_par_id: None,
        }
    }
}

#[allow(dead_code)]
pub fn save_transacao_internal(conn: &rusqlite::Connection, transacao: &Transacao) -> Result<i64, String> {
    if let Some(res_id) = transacao.reserva_id {
        if transacao.tipo == "despesa" {
            let cat_nome_res: Result<String, _> = conn.query_row("SELECT nome FROM categorias WHERE id = ?1", params![res_id], |row| row.get(0));
            if let Ok(cat_nome) = cat_nome_res {
                let aportes: f64 = conn.query_row(
                    "SELECT COALESCE(SUM(CASE WHEN is_transferencia = 0 THEN valor ELSE 0 END), 0) FROM transacoes WHERE tipo = 'reserva' AND categoria = ?1",
                    params![cat_nome],
                    |row| row.get(0)
                ).unwrap_or(0.0);
                
                let despesas: f64 = conn.query_row(
                    "SELECT COALESCE(SUM(valor), 0) FROM transacoes WHERE tipo = 'despesa' AND reserva_id = ?1 AND id != ?2",
                    params![res_id, transacao.id.unwrap_or(0)],
                    |row| row.get(0)
                ).unwrap_or(0.0);
                
                let saldo_atual = aportes - despesas;
                
                if saldo_atual < transacao.valor {
                    return Err(format!("SALDO_INSUFICIENTE|{}", saldo_atual));
                }
            }
        }
    }

    match transacao.id {
        Some(id) if id > 0 => {
            conn.execute(
                "UPDATE transacoes SET descricao = ?1, valor = ?2, data = ?3, tipo = ?4, categoria = ?5, obs = ?6, recorrente_id = ?7, reserva_id = ?8, is_transferencia = ?9, transferencia_par_id = ?10 WHERE id = ?11",
                params![&transacao.descricao, transacao.valor, &transacao.data, &transacao.tipo, &transacao.categoria, &transacao.obs, transacao.recorrente_id, transacao.reserva_id, transacao.is_transferencia, transacao.transferencia_par_id, id],
            ).map_err(|e| e.to_string())?;
            Ok(id)
        }
        _ => {
            conn.execute(
                "INSERT INTO transacoes (descricao, valor, data, tipo, categoria, obs, recorrente_id, reserva_id, is_transferencia, transferencia_par_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![&transacao.descricao, transacao.valor, &transacao.data, &transacao.tipo, &transacao.categoria, &transacao.obs, transacao.recorrente_id, transacao.reserva_id, transacao.is_transferencia, transacao.transferencia_par_id],
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
    let mut stmt = conn.prepare("SELECT t.id, t.descricao, t.valor, t.data, t.tipo, t.categoria, t.obs, t.recorrente_id, t.reserva_id, t.is_transferencia, t.transferencia_par_id, c.nome FROM transacoes t LEFT JOIN categorias c ON t.reserva_id = c.id ORDER BY t.data DESC").map_err(|e| e.to_string())?;

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
            reserva_id: row.get(8)?,
            is_transferencia: row.get(9).unwrap_or(0),
            transferencia_par_id: row.get(10)?,
            reserva_nome: row.get(11)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(transacoes)
}

#[tauri::command]
pub fn save_transacao(transacao: Transacao, state: tauri::State<DbState>) -> Result<i64, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    save_transacao_internal(&conn, &transacao)
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
            ..Default::default()
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
            ..Default::default()
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
             ..Default::default()
         };

         let id = save_transacao_internal(&conn, &transacao).unwrap();
         delete_transacao_internal(&conn, id).unwrap();

         let count: i64 = conn.query_row("SELECT COUNT(*) FROM transacoes WHERE id = ?1", params![id], |r| r.get(0)).unwrap_or(0);
         assert_eq!(count, 0);
     }
 }

 pub mod export;
