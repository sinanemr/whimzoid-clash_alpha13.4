# Deploy the shared multiplayer server — one-time setup (~10 minutes)

This puts the **online server** on the internet once, so room codes work across
different networks. It's the server the **installed desktop game** connects to (see
[DESKTOP-BUILD.md](DESKTOP-BUILD.md)); after deploying, you set its `wss://…/ws`
address in `js/net-config.js` and build the installer.

You get a permanent URL, e.g. `https://whimzoid-clash.onrender.com`. Two bonuses:
that URL also serves a **browser version** of the game (handy for quick testing in two
tabs), and the WebSocket endpoint is that URL as `wss://…/ws`.

You only do this **once**. It's free. You'll make two free accounts (GitHub + Render)
and click through a few screens. No commands, no coding.

---

## Part A — Put the game on GitHub (using the GitHub Desktop app)

GitHub is just online storage for the game's files; Render (Part B) reads from it.

1. **Make a free GitHub account:** go to <https://github.com> → **Sign up**.
2. **Install GitHub Desktop:** download from <https://desktop.github.com>, install it,
   and **sign in** with the account from step 1.
3. In GitHub Desktop: **File → Add local repository…**
4. Click **Choose…** and select this folder:
   `C:\Users\semre\Documents\Mincik Game\whimzoid-clash_alpha13.4`
5. It will say "this directory is not a Git repository" — click the blue
   **"create a repository"** link, then click **Create repository**.
   (A `.gitignore` file is already included so it won't upload junk.)
6. Click **Publish repository** (top right). You can tick **"Keep this code private"** —
   that's fine. Click **Publish repository**.

Done — your game files are now on GitHub.

---

## Part B — Deploy it on Render (free)

Render runs the little server so the room codes work over the internet.

1. Go to <https://render.com> → **Get Started / Sign up**. Choosing **"Sign in with
   GitHub"** is easiest (it links the account from Part A). Authorize it.
2. On the dashboard click **New +** (top right) → **Web Service**.
3. **Connect** your GitHub if asked, then find and select your **whimzoid-clash** repo →
   **Connect**.
4. Render fills most fields in automatically. Check these:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** **Free**
5. Click **Create Web Service** (or **Deploy**).
6. Wait a couple of minutes until the status turns **Live**. Near the top you'll see
   your URL, like `https://whimzoid-clash.onrender.com`. **That's your game link.**

---

## Part C — Point the game at it & test

1. Copy your new `wss://…/ws` URL into **`js/net-config.js`** (`NETWORK_CONFIG.serverUrl`),
   then build the installer — see **[DESKTOP-BUILD.md](DESKTOP-BUILD.md)**.
2. **Quick browser test (optional):** open the Render URL in two tabs →
   **MULTIPLAYER → CREATE PRIVATE ROOM** in one, read the 6-letter code, **MULTIPLAYER
   → type code → JOIN PRIVATE ROOM** in the other → pick fighters → both **READY** →
   host **START MATCH**.

Players themselves never touch this URL — the installed game already has it baked in
and connects automatically.

---

## Good to know

- **First open of the day may take ~30–60 seconds.** Render's free plan puts the
  server to sleep after 15 minutes of no use; the first visit wakes it up. Just wait
  on the loading page — it only happens on the first load, then it's instant.
- **It's still host-authoritative:** whoever creates the room runs the match; the
  other player can feel a little input delay depending on distance/connection. This is
  the reliable first online version, not rollback netcode.
- **Local dev:** `npm start` runs the same server on `http://localhost:8080` for
  two-tab testing; double-clicking `RUN_GAME.html` still runs offline/local play.
- **Updating the game later:** make your edits, open GitHub Desktop → it shows the
  changes → type a short message → **Commit to main** → **Push origin**. Render
  redeploys automatically within a minute.
- **Alternative hosts:** Railway (<https://railway.app>) and Glitch
  (<https://glitch.com>, "Import from GitHub") also run this the same way — any free
  host that runs a Node app and allows WebSockets works, because the game and the
  online server are one program (`npm start`).
