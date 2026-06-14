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
            "SELECT COALESCE(SUM(valor), 0) FROM transacoes WHERE tipo = 'reserva' AND categoria = ?1",
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
            COALESCE((SELECT SUM(valor) FROM transacoes WHERE tipo = 'reserva' AND categoria = c.nome), 0)
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
    transferir_reserva_internal(&mut conn_guard, &payload)
}

fn transferir_reserva_internal(conn: &mut rusqlite::Connection, payload: &TransferirReservaPayload) -> Result<(), String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let saldo_origem = get_saldo_atual_internal(&tx, payload.origem_id)?;
    if saldo_origem < payload.valor {
        return Err(format!("SALDO_INSUFICIENTE|{}", saldo_origem));
    }

    let cat_origem: String = tx.query_row("SELECT nome FROM categorias WHERE id = ?1", params![payload.origem_id], |row| row.get(0)).map_err(|e| e.to_string())?;
    let cat_destino: String = tx.query_row("SELECT nome FROM categorias WHERE id = ?1", params![payload.destino_id], |row| row.get(0)).map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO transacoes (descricao, valor, data, tipo, categoria, obs, reserva_id, is_transferencia) VALUES (?1, ?2, ?3, 'despesa', ?4, ?5, ?6, 1)",
        params![payload.descricao, payload.valor, payload.data, cat_origem, format!("Transferência para {}", cat_destino), payload.origem_id],
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::db::test_utils::test_db_connection;
    use crate::modules::transactions::Transacao;

    fn setup_reserves(conn: &mut rusqlite::Connection) -> (i64, i64) {
        conn.execute_batch(
            "INSERT INTO categorias (nome, tipo, cor) VALUES
                ('Reserva A', 'reserva', '#4ade80'),
                ('Reserva B', 'reserva', '#60a5fa');"
        ).unwrap();
        let origem_id: i64 = conn.query_row("SELECT id FROM categorias WHERE nome = 'Reserva A'", [], |row| row.get(0)).unwrap();
        let destino_id: i64 = conn.query_row("SELECT id FROM categorias WHERE nome = 'Reserva B'", [], |row| row.get(0)).unwrap();
        (origem_id, destino_id)
    }

    #[test]
    fn test_transferir_reserva_cria_par_sem_valor_negativo() {
        let mut conn = test_db_connection().unwrap();
        let (origem_id, destino_id) = setup_reserves(&mut conn);

        let aporte = Transacao {
            descricao: "Aporte".to_string(),
            valor: 100.0,
            data: "2026-06-11".to_string(),
            tipo: "reserva".to_string(),
            categoria: "Reserva A".to_string(),
            ..Default::default()
        };
        crate::modules::transactions::save_transacao_internal(&conn, &aporte).unwrap();

        let payload = TransferirReservaPayload {
            origem_id,
            destino_id,
            valor: 40.0,
            data: "2026-06-11".to_string(),
            descricao: "Transferência".to_string(),
        };
        transferir_reserva_internal(&mut conn, &payload).unwrap();

        let origem_valor: f64 = conn.query_row(
            "SELECT valor FROM transacoes WHERE categoria = 'Reserva A' AND tipo = 'despesa' AND is_transferencia = 1 ORDER BY id LIMIT 1",
            [],
            |row| row.get(0),
        ).unwrap();
        let destino_valor: f64 = conn.query_row(
            "SELECT valor FROM transacoes WHERE categoria = 'Reserva B' AND is_transferencia = 1 ORDER BY id LIMIT 1",
            [],
            |row| row.get(0),
        ).unwrap();
        let origem_saldo = get_saldo_atual_internal(&conn, origem_id).unwrap();
        let destino_saldo = get_saldo_atual_internal(&conn, destino_id).unwrap();

        assert!(origem_valor > 0.0);
        assert!(destino_valor > 0.0);
        assert_eq!(origem_saldo, 60.0);
        assert_eq!(destino_saldo, 40.0);
    }

    #[test]
    fn test_transferir_reserva_bloqueia_saldo_insuficiente() {
        let mut conn = test_db_connection().unwrap();
        let (origem_id, destino_id) = setup_reserves(&mut conn);

        let aporte = Transacao {
            descricao: "Aporte".to_string(),
            valor: 50.0,
            data: "2026-06-11".to_string(),
            tipo: "reserva".to_string(),
            categoria: "Reserva A".to_string(),
            ..Default::default()
        };
        crate::modules::transactions::save_transacao_internal(&conn, &aporte).unwrap();

        let payload = TransferirReservaPayload {
            origem_id,
            destino_id,
            valor: 75.0,
            data: "2026-06-11".to_string(),
            descricao: "Transferência".to_string(),
        };
        let result = transferir_reserva_internal(&mut conn, &payload);

        assert!(result.is_err());
        assert!(result.unwrap_err().starts_with("SALDO_INSUFICIENTE"));
    }
}
