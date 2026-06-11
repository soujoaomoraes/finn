use rusqlite::params;
use serde::{Deserialize, Serialize};
use crate::infrastructure::db::DbState;

#[derive(Debug, Serialize, Deserialize)]
pub struct Categoria {
    pub id: Option<i64>,
    pub nome: String,
    pub tipo: String,
    pub cor: String,
}

#[tauri::command]
pub fn get_all_categorias(state: tauri::State<DbState>) -> Result<Vec<Categoria>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, nome, tipo, cor FROM categorias ORDER BY nome").map_err(|e| e.to_string())?;
    
    let categorias = stmt.query_map([], |row| {
        Ok(Categoria {
            id: row.get(0)?,
            nome: row.get(1)?,
            tipo: row.get(2)?,
            cor: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(categorias)
}

#[tauri::command]
pub fn save_categoria(categoria: Categoria, state: tauri::State<DbState>) -> Result<i64, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    match categoria.id {
        Some(id) if id > 0 => {
            conn.execute(
                "UPDATE categorias SET nome = ?1, tipo = ?2, cor = ?3 WHERE id = ?4",
                params![categoria.nome, categoria.tipo, categoria.cor, id],
            ).map_err(|e| e.to_string())?;
            Ok(id)
        }
        _ => {
            conn.execute(
                "INSERT INTO categorias (nome, tipo, cor) VALUES (?1, ?2, ?3)",
                params![categoria.nome, categoria.tipo, categoria.cor],
            ).map_err(|e| e.to_string())?;
            Ok(conn.last_insert_rowid())
        }
    }
}

#[tauri::command]
pub fn delete_categoria(id: i64, state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let tipo: Result<String, _> = conn.query_row("SELECT tipo FROM categorias WHERE id = ?1", params![id], |row| row.get(0));
    if let Ok(t) = tipo {
        if t == "reserva" {
            let saldo = crate::modules::reserves::get_saldo_atual_internal(&conn, id).unwrap_or(0.0);
            if saldo > 0.0 {
                return Err(format!("SALDO_MAIOR_QUE_ZERO|{}", saldo));
            }
        }
    }

    conn.execute("DELETE FROM categorias WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}
