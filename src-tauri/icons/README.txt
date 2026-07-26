APP ICONS — required before building the installer
==================================================

Tauri needs real icon files here (32x32.png, 128x128.png, 128x128@2x.png,
icon.ico, icon.icns). They are NOT committed because they are binary; you
generate them once from a single square PNG logo.

From the project root (the folder with package.json), run ONE of:

    npm run tauri icon path\to\your-logo.png
        (after `npm install`, which installs the Tauri CLI)

    npx @tauri-apps/cli icon path\to\your-logo.png

Use a square PNG, ideally 1024x1024. The command fills this icons/ folder with
every size/format Tauri needs. After that, `npm run tauri build` will work.

If you don't have a logo yet, any square PNG works to get a build out the door.
