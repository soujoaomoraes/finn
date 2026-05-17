fn main() {
    tauri_build::build();
    
    // Lê as credenciais do arquivo .env na raiz do projeto
    let mut client_id = "SEU_CLIENT_ID".to_string();
    let mut client_secret = "SEU_CLIENT_SECRET".to_string();
    
    if let Ok(content) = std::fs::read_to_string("../.env") {
        for line in content.lines() {
            if line.starts_with("GOOGLE_CLIENT_ID=") {
                client_id = line.replace("GOOGLE_CLIENT_ID=", "").trim().to_string();
            }
            if line.starts_with("GOOGLE_CLIENT_SECRET=") {
                client_secret = line.replace("GOOGLE_CLIENT_SECRET=", "").trim().to_string();
            }
        }
    }
    
    println!("cargo:rustc-env=GOOGLE_CLIENT_ID={}", client_id);
    println!("cargo:rustc-env=GOOGLE_CLIENT_SECRET={}", client_secret);
}
