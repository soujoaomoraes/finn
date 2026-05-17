use rusqlite::params;
use serde::{Deserialize, Serialize};
use crate::db::DbState;
use std::fs::File;
use std::io::Write;

#[derive(Debug, Serialize, Deserialize)]
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

#[tauri::command]
pub fn export_csv(start_date: String, end_date: String, file_path: String, state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT data, descricao, valor, tipo, categoria FROM transacoes WHERE data >= ?1 AND data <= ?2 ORDER BY data"
    ).map_err(|e| e.to_string())?;
    
    let transacoes = stmt.query_map(params![start_date, end_date], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
        ))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect::<Vec<_>>();

    let mut file = File::create(&file_path).map_err(|e| e.to_string())?;
    
    // Escreve o BOM do UTF-8 para que o Excel identifique os acentos corretamente
    file.write_all(b"\xEF\xBB\xBF").map_err(|e| e.to_string())?;
    
    // CSV header usando ponto e vírgula para compatibilidade com Excel PT-BR
    writeln!(file, "Data;Descrição;Valor;Tipo;Categoria").map_err(|e| e.to_string())?;
    
    // CSV rows
    for (data, descricao, valor, tipo, categoria) in transacoes {
        // Converte a data de YYYY-MM-DD para DD/MM/YYYY
        let data_br = {
            let parts: Vec<&str> = data.split('-').collect();
            if parts.len() == 3 {
                format!("{}/{}/{}", parts[2], parts[1], parts[0])
            } else {
                data.clone()
            }
        };
        // Formata o valor com vírgula para decimal
        let valor_br = format!("{:.2}", valor).replace('.', ",");
        
        writeln!(file, "{};{};{};{};{}", data_br, descricao, valor_br, tipo, categoria).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
