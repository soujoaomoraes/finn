use rusqlite::params;
use serde::{Deserialize, Serialize};
use crate::infrastructure::db::DbState;

#[derive(Debug, Serialize, Deserialize)]
pub struct ReservaSaldo {
    pub reserva_id: i64,
    pub nome: String,
    pub cor: String,
    pub saldo_atual: f64,
    pub meta_valor: Option<f64>,
    pub percentual: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct TransferirReservaPayload {
    pub origem_id: i64,
    pub destino_id: i64,
    pub valor: f64,
    pub data: String,
    pub descricao: String,
}

pub fn get_saldo_atual_internal(conn: &rusqlite::Connection, reserva_id: i64) -> Result<f64, String> {
    let cat_nome_res: Result<String, _> = conn.query_row("SELECT nome FROM categorias WHERE id = ?1", params![reserva_id], |row| row.get(0));
    if let Ok(cat_nome) = cat_nome_res {
        let aportes: f64 = conn.query_row(
            "SELECT COALESCE(SUM(CASE WHEN is_transferencia = 0 THEN valor ELSE 0 END), 0) FROM transacoes WHERE tipo = 'reserva' AND categoria = ?1",
            params![cat_nome],
            |row| row.get(0)
        ).unwrap_or(0.0);
        
        let despesas: f64 = conn.query_row(
            "SELECT COALESCE(SUM(valor), 0) FROM transacoes WHERE tipo = 'despesa' AND reserva_id = ?1",
            params![reserva_id],
            |row| row.get(0)
        ).unwrap_or(0.0);
        
        Ok(aportes - despesas)
    } else {
        Err("Reserva não encontrada".to_string())
    }
}

#[tauri::command]
pub fn get_reserva_saldos(state: tauri::State<DbState>) -> Result<Vec<ReservaSaldo>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT 
            c.id,
            c.nome,
            c.cor,
            COALESCE((SELECT SUM(CASE WHEN is_transferencia = 0 THEN valor ELSE 0 END) FROM transacoes WHERE tipo = 'reserva' AND categoria = c.nome), 0)
            - COALESCE((SELECT SUM(valor) FROM transacoes WHERE tipo = 'despesa' AND reserva_id = c.id), 0) AS saldo_atual,
            m.valor_meta
         FROM categorias c
         LEFT JOIN metas m ON m.categoria_id = c.id AND m.ativa = 1
         WHERE c.tipo = 'reserva'
         GROUP BY c.id, c.nome, c.cor, m.valor_meta
         ORDER BY c.nome"
    ).map_err(|e| e.to_string())?;

    let saldos = stmt.query_map([], |row| {
        let reserva_id: i64 = row.get(0)?;
        let nome: String = row.get(1)?;
        let cor: String = row.get(2)?;
        let saldo_atual: f64 = row.get(3)?;
        let meta_valor: Option<f64> = row.get(4)?;
        
        let percentual = meta_valor.and_then(|v| if v > 0.0 { Some((saldo_atual / v) * 100.0) } else { None });

        Ok(ReservaSaldo {
            reserva_id,
            nome,
            cor,
            saldo_atual,
            meta_valor,
            percentual,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(saldos)
}

#[tauri::command]
pub fn transferir_reserva(payload: TransferirReservaPayload, state: tauri::State<DbState>) -> Result<(), String> {
    let mut conn_guard = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn_guard.transaction().map_err(|e| e.to_string())?;

    let saldo_origem = get_saldo_atual_internal(&tx, payload.origem_id)?;
    if saldo_origem < payload.valor {
        return Err(format!("SALDO_INSUFICIENTE|{}", saldo_origem));
    }

    let cat_origem: String = tx.query_row("SELECT nome FROM categorias WHERE id = ?1", params![payload.origem_id], |row| row.get(0)).map_err(|e| e.to_string())?;
    let cat_destino: String = tx.query_row("SELECT nome FROM categorias WHERE id = ?1", params![payload.destino_id], |row| row.get(0)).map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO transacoes (descricao, valor, data, tipo, categoria, obs, is_transferencia) VALUES (?1, ?2, ?3, 'reserva', ?4, ?5, 1)",
        params![payload.descricao, -payload.valor, payload.data, cat_origem, format!("Transferência para {}", cat_destino)],
    ).map_err(|e| e.to_string())?;
    let id_origem = tx.last_insert_rowid();

    tx.execute(
        "INSERT INTO transacoes (descricao, valor, data, tipo, categoria, obs, is_transferencia) VALUES (?1, ?2, ?3, 'reserva', ?4, ?5, 1)",
        params![payload.descricao, payload.valor, payload.data, cat_destino, format!("Transferência de {}", cat_origem)],
    ).map_err(|e| e.to_string())?;
    let id_destino = tx.last_insert_rowid();

    tx.execute("UPDATE transacoes SET transferencia_par_id = ?1 WHERE id = ?2", params![id_destino, id_origem]).map_err(|e| e.to_string())?;
    tx.execute("UPDATE transacoes SET transferencia_par_id = ?1 WHERE id = ?2", params![id_origem, id_destino]).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
