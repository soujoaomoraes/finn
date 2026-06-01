use rusqlite::params;
use crate::infrastructure::db::DbState;
use std::fs::File;
use std::io::Write;

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