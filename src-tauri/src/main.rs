// Prevents an extra terminal window from opening alongside the game on Windows
// release builds. Do not remove.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    what_just_hit_me_lib::run();
}
