// Prevents an extra terminal window from opening alongside the game on Windows
// release builds. Do not remove.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    whimzoid_clash_lib::run();
}
