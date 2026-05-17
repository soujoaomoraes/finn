use rusqlite::params;
use serde::{Deserialize, Serialize};
use crate::db::DbState;
use chrono::{Duration, NaiveDate, Datelike};

#[derive(Debug, Serialize, Deserialize)]
pub struct Recorrente {
    pub id: Option<i64>,
    pub descricao: String,
    pub valor: f64,
    pub tipo: String,
    pub categoria: String,
    pub obs: String,
    pub frequencia: String,
    pub dia_vencimento: Option<i32>,
    pub proximo_vencimento: String,
    pub ativo: bool,
    pub data_inicio: String,
}

#[tauri::command]
pub fn get_all_recorrentes(state: tauri::State<DbState>) -> Result<Vec<Recorrente>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, descricao, valor, tipo, categoria, obs, frequencia, dia_vencimento, proximo_vencimento, ativo, data_inicio FROM recorrentes ORDER BY proximo_vencimento").map_err(|e| e.to_string())?;

    let recorrentes = stmt.query_map([], |row| {
        Ok(Recorrente {
            id: row.get(0)?,
            descricao: row.get(1)?,
            valor: row.get(2)?,
            tipo: row.get(3)?,
            categoria: row.get(4)?,
            obs: row.get(5)?,
            frequencia: row.get(6)?,
            dia_vencimento: row.get(7)?,
            proximo_vencimento: row.get(8)?,
            ativo: row.get::<_, i32>(9)? == 1,
            data_inicio: row.get(10)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(recorrentes)
}

#[tauri::command]
pub fn save_recorrente(recorrente: Recorrente, state: tauri::State<DbState>) -> Result<i64, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    match recorrente.id {
        Some(id) if id > 0 => {
            conn.execute(
                "UPDATE recorrentes SET descricao = ?1, valor = ?2, tipo = ?3, categoria = ?4, obs = ?5, frequencia = ?6, dia_vencimento = ?7, proximo_vencimento = ?8, ativo = ?9, data_inicio = ?10 WHERE id = ?11",
                params![
                    recorrente.descricao,
                    recorrente.valor,
                    recorrente.tipo,
                    recorrente.categoria,
                    recorrente.obs,
                    recorrente.frequencia,
                    recorrente.dia_vencimento,
                    recorrente.proximo_vencimento,
                    if recorrente.ativo { 1 } else { 0 },
                    recorrente.data_inicio,
                    id
                ],
            ).map_err(|e| e.to_string())?;
            Ok(id)
        }
        _ => {
            conn.execute(
                "INSERT INTO recorrentes (descricao, valor, tipo, categoria, obs, frequencia, dia_vencimento, proximo_vencimento, ativo, data_inicio) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    recorrente.descricao,
                    recorrente.valor,
                    recorrente.tipo,
                    recorrente.categoria,
                    recorrente.obs,
                    recorrente.frequencia,
                    recorrente.dia_vencimento,
                    recorrente.proximo_vencimento,
                    if recorrente.ativo { 1 } else { 0 },
                    recorrente.data_inicio
                ],
            ).map_err(|e| e.to_string())?;
            Ok(conn.last_insert_rowid())
        }
    }
}

#[tauri::command]
pub fn delete_recorrente(id: i64, state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM recorrentes WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_recorrente(id: i64, state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE recorrentes SET ativo = CASE WHEN ativo = 1 THEN 0 ELSE 1 END WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn calculate_next_due_date(current_date: &str, frequency: &str, day_of_month: Option<i32>) -> Result<String, String> {
    let date = NaiveDate::parse_from_str(current_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}", e))?;

    let next_date = match frequency {
        "mensal" => {
            if let Some(day) = day_of_month {
                // Use the specified day of month
                let next_month = if date.day() as i32 >= day {
                    date + Duration::days(32)
                } else {
                    date
                };
                let mut next = NaiveDate::from_ymd_opt(next_month.year(), next_month.month(), day as u32)
                    .ok_or_else(|| "Invalid day for month".to_string())?;
                // If we went to next month but the day doesn't exist (e.g., Feb 30), use last day of month
                if next.day() as i32 != day && next.month() != date.month() {
                    next = NaiveDate::from_ymd_opt(next.year(), next.month(), 1).unwrap()
                        .with_month(next.month()).unwrap()
                        .with_day(1).unwrap()
                        - Duration::days(1);
                }
                next
            } else {
                // Same day next month
                date + Duration::days(32)
            }
        }
        "semanal" => date + Duration::days(7),
        "quinzenal" => date + Duration::days(14),
        _ => return Err(format!("Invalid frequency: {}", frequency)),
    };

    Ok(next_date.format("%Y-%m-%d").to_string())
}

#[tauri::command]
pub fn generate_due_recorrentes(state: tauri::State<DbState>) -> Result<i32, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Get all active recorrentes
    let mut stmt = conn.prepare("SELECT id, descricao, valor, tipo, categoria, obs, frequencia, dia_vencimento, proximo_vencimento, data_inicio FROM recorrentes WHERE ativo = 1").map_err(|e| e.to_string())?;

    let recorrentes = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
            row.get::<_, Option<i32>>(7)?,
            row.get::<_, String>(8)?,
            row.get::<_, String>(9)?,
        ))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect::<Vec<_>>();

    let mut generated_count = 0;

    for (id, descricao, valor, tipo, categoria, obs, frequencia, dia_vencimento, proximo_vencimento, _data_inicio) in recorrentes {
        let mut current_proximo = proximo_vencimento.clone();

        // Generate transactions for all due dates
        loop {
            let next_date = calculate_next_due_date(&current_proximo, &frequencia, dia_vencimento)?;

            if next_date > today {
                // Update the recorrente's proximo_vencimento
                conn.execute(
                    "UPDATE recorrentes SET proximo_vencimento = ?1 WHERE id = ?2",
                    params![current_proximo, id],
                ).map_err(|e| e.to_string())?;
                break;
            }

            // Create transaction for this due date
            conn.execute(
                "INSERT INTO transacoes (descricao, valor, data, tipo, categoria, obs, recorrente_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![descricao, valor, current_proximo, tipo, categoria, obs, id],
            ).map_err(|e| e.to_string())?;

            generated_count += 1;
            current_proximo = next_date;
        }
    }

    Ok(generated_count)
}
