use rusqlite::params;
use serde::{Deserialize, Serialize};
use crate::infrastructure::db::DbState;
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

pub fn calculate_next_due_date(
    current_date: &str,
    frequency: &str,
    day_of_month: Option<i32>,
) -> Result<String, String> {
    let date = NaiveDate::parse_from_str(current_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}", e))?;

    let next_date = match frequency {
        "mensal" => {
            if let Some(day) = day_of_month {
                let (next_year, next_month) = if date.day() as i32 >= day {
                    get_next_month_date(date)
                } else {
                    (date.year(), date.month())
                };

                let last_day = max_day_in_month(next_year, next_month);
                let target_day = day.min(last_day);

                NaiveDate::from_ymd_opt(next_year, next_month, target_day as u32)
                    .ok_or_else(|| format!("Invalid day {} for month {}/{}", target_day, next_month, next_year))?
            } else {
                let (next_year, next_month) = get_next_month_date(date);
                NaiveDate::from_ymd_opt(next_year, next_month, date.day())
                    .ok_or_else(|| "Invalid day for month".to_string())?
            }
        }
        "semanal" => date + Duration::days(7),
        "quinzenal" => date + Duration::days(14),
        "anual" => {
            date + Duration::days(365)
        }
        _ => return Err(format!("Invalid frequency: {}", frequency)),
    };

    Ok(next_date.format("%Y-%m-%d").to_string())
}

fn max_day_in_month(year: i32, month: u32) -> i32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

fn get_next_month_date(date: NaiveDate) -> (i32, u32) {
    let year = date.year();
    let month = date.month();
    if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    }
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

        loop {
            let next_date = calculate_next_due_date(&current_proximo, &frequencia, dia_vencimento)?;

            if next_date > today {
                conn.execute(
                    "UPDATE recorrentes SET proximo_vencimento = ?1 WHERE id = ?2",
                    params![current_proximo, id],
                ).map_err(|e| e.to_string())?;
                break;
            }

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mensal_varios_meses_atrasados() {
        let mut current = "2026-02-05".to_string();
        let mut dates = Vec::new();
        let today = "2026-05-15";

        for _ in 0..3 {
            let next = calculate_next_due_date(&current, "mensal", Some(5)).unwrap();
            if next.as_str() >= today { break; }
            dates.push(next.clone());
            current = next;
        }

        assert_eq!(dates.len(), 3);
        assert_eq!(dates[0], "2026-03-05");
        assert_eq!(dates[1], "2026-04-05");
        assert_eq!(dates[2], "2026-05-05");
    }

    #[test]
    fn test_clamp_dia_31_fevereiro() {
        let next = calculate_next_due_date("2026-01-31", "mensal", Some(31)).unwrap();
        assert_eq!(next, "2026-02-28");
    }

    #[test]
    fn test_semanal_7_dias() {
        let next = calculate_next_due_date("2026-05-10", "semanal", None).unwrap();
        assert_eq!(next, "2026-05-17");
    }

    #[test]
    fn test_anual_365_dias() {
        let next = calculate_next_due_date("2025-03-15", "anual", Some(15)).unwrap();
        assert_eq!(next, "2026-03-15");
    }

    #[test]
    fn test_quinzenal_14_dias() {
        let next = calculate_next_due_date("2026-05-01", "quinzenal", None).unwrap();
        assert_eq!(next, "2026-05-15");
    }

    #[test]
    fn test_dia_inicio_nao_gera_antes() {
        let result = calculate_next_due_date("2026-05-01", "mensal", Some(5)).unwrap();
        assert!(result.as_str() > "2026-05-01" || result == "2026-05-05");
    }
}
