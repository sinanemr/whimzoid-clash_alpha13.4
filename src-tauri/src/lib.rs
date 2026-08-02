// What Just Hit Me desktop shell. This wraps the existing HTML/CSS/JS/Canvas game
// (bundled from ../dist) in a native window. All gameplay + networking is the web
// code; Rust only hosts the webview. The online client connects to the public
// server configured in js/net-config.js (NETWORK_CONFIG.serverUrl).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the What Just Hit Me desktop app");
}
