use rusqlite::params;
use serde::{Deserialize, Serialize};
use crate::infrastructure::db::DbState;

#[derive(Debug, Serialize, Deserialize)]
pub struct MetaResumo {
    pub id: i64,
    pub categoria_id: i64,
    pub categoria_nome: String,
    pub categoria_cor: String,
    pub tipo: String,
    pub valor_meta: f64,
    pub valor_realizado: f64,
    pub percentual: f64,
    pub periodo: String,
    pub data_inicio: String,
    pub data_limite: Option<String>,
    pub ativa: bool,
}

#[derive(Debug, Deserialize)]
pub struct MetaInput {
    pub id: Option<i64>,
    pub categoria_id: i64,
    pub tipo: String,
    pub valor_meta: f64,
    pub periodo: String,
    pub data_inicio: String,
    pub data_limite: Option<String>,
    #[serde(default = "default_ativa")]
    pub ativa: bool,
}

fn default_ativa() -> bool {
    true
}

#[derive(Debug, Deserialize)]
pub struct GetAllMetasPayload {
    pub data_inicio: String,
    pub data_fim: String,
}

#[tauri::command]
pub fn get_all_metas(payload: GetAllMetasPayload, state: tauri::State<DbState>) -> Result<Vec<MetaResumo>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT 
            m.id, m.categoria_id, c.nome, c.cor, m.tipo, m.valor_meta, m.periodo, m.data_inicio, m.data_limite, m.ativa
         FROM metas m
         JOIN categorias c ON m.categoria_id = c.id
         ORDER BY c.nome"
    ).map_err(|e| e.to_string())?;

    let metas_db = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, f64>(5)?,
            row.get::<_, String>(6)?,
            row.get::<_, String>(7)?,
            row.get::<_, Option<String>>(8)?,
            row.get::<_, i64>(9)? == 1,
        ))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect::<Vec<_>>();

    let mut resultados = Vec::new();

    for (id, categoria_id, categoria_nome, categoria_cor, tipo, valor_meta, periodo, data_inicio, data_limite, ativa) in metas_db {
        let valor_realizado = if tipo == "reserva" {
            crate::modules::reserves::get_saldo_atual_internal(&conn, categoria_id).unwrap_or(0.0)
        } else {
            conn.query_row(
                "SELECT COALESCE(SUM(valor), 0) FROM transacoes WHERE categoria = ?1 AND tipo = ?2 AND data >= ?3 AND data <= ?4",
                params![categoria_nome, tipo, payload.data_inicio, payload.data_fim],
                |row| row.get(0)
            ).unwrap_or(0.0)
        };

        let percentual = if valor_meta > 0.0 {
            (valor_realizado / valor_meta) * 100.0
        } else {
            0.0
        };

        resultados.push(MetaResumo {
            id,
            categoria_id,
            categoria_nome,
            categoria_cor,
            tipo,
            valor_meta,
            valor_realizado,
            percentual,
            periodo,
            data_inicio,
            data_limite,
            ativa,
        });
    }

    Ok(resultados)
}

#[tauri::command]
pub fn save_meta(meta: MetaInput, state: tauri::State<DbState>) -> Result<i64, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    match meta.id {
        Some(id) if id > 0 => {
            conn.execute(
                "UPDATE metas SET categoria_id = ?1, tipo = ?2, valor_meta = ?3, periodo = ?4, data_inicio = ?5, data_limite = ?6, ativa = ?7, updated_at = ?8 WHERE id = ?9",
                params![meta.categoria_id, meta.tipo, meta.valor_meta, meta.periodo, meta.data_inicio, meta.data_limite, if meta.ativa { 1 } else { 0 }, now, id],
            ).map_err(|e| e.to_string())?;
            Ok(id)
        }
        _ => {
            conn.execute(
                "INSERT INTO metas (categoria_id, tipo, valor_meta, periodo, data_inicio, data_limite, ativa, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![meta.categoria_id, meta.tipo, meta.valor_meta, meta.periodo, meta.data_inicio, meta.data_limite, if meta.ativa { 1 } else { 0 }, now, now],
            ).map_err(|e| e.to_string())?;
            Ok(conn.last_insert_rowid())
        }
    }
}

#[tauri::command]
pub fn delete_meta(id: i64, state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM metas WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_meta(id: i64, state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE metas SET ativa = CASE WHEN ativa = 1 THEN 0 ELSE 1 END, updated_at = ?1 WHERE id = ?2",
        params![now, id]
    ).map_err(|e| e.to_string())?;
    Ok(())
}
