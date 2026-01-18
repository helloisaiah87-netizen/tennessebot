const express = require("express");
const axios = require("axios");
const localtunnel = require("localtunnel");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const app = express();

// ==========================================
// 🛠️ USER SETTINGS
// ==========================================
const DEFAULT_CONFIG = {
    serverName: "Tennessee Bot",
    erlcKey: process.env.ERLC_KEY || "",
    erlcUrl:
        process.env.ERLC_BASE_API_URL ||
        "https://api.policeroleplay.community/v1",
    masterKey: "admin123", // <--- DEV/MASTER PASSWORD
    inviteCode: "welcome", // <--- STAFF REGISTRATION CODE
    port: 1027,
};

const DB_FILE = path.join(__dirname, "dashboard_db.json");

// Global Cache
let DB = loadDB();
let PUBLIC_IP = "Loading...";

// ==========================================
// 💾 DATABASE SYSTEM
// ==========================================
function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { config: DEFAULT_CONFIG, users: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 🎨 FRONTEND: TENNESSEE BOT OS
// ==========================================
const frontendHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tennessee Bot | Manager</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&display=swap" rel="stylesheet">
    <style>
        :root { --bg: #09090b; --sidebar: #121214; --card: #18181b; --border: #27272a; --accent: #5865F2; --text: #fff; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }

        /* AUTH OVERLAY */
        #auth-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--bg); z-index: 1000; display: flex; justify-content: center; align-items: center; }
        .auth-box { background: var(--card); padding: 40px; border-radius: 16px; border: 1px solid var(--border); width: 360px; text-align: center; }
        .input-group { margin-bottom: 15px; text-align: left; }
        .input-group label { display: block; font-size: 0.8rem; color: #888; margin-bottom: 5px; }
        input { width: 100%; padding: 12px; background: #000; border: 1px solid var(--border); border-radius: 6px; color: white; outline: none; }
        input:focus { border-color: var(--accent); }
        .btn { width: 100%; padding: 12px; background: var(--accent); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; margin-top: 10px; transition: 0.2s; }
        .btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn.secondary { background: var(--border); margin-top: 10px; }

        /* LAYOUT */
        .sidebar { width: 260px; background: var(--sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 20px; }
        .brand { font-size: 1.2rem; font-weight: 800; display: flex; align-items: center; gap: 10px; margin-bottom: 40px; color: var(--accent); }
        .nav-item { padding: 12px 15px; border-radius: 8px; cursor: pointer; color: #888; transition: 0.2s; display: flex; align-items: center; gap: 12px; font-weight: 500; margin-bottom: 5px; }
        .nav-item:hover, .nav-item.active { background: var(--accent); color: white; }

        .user-profile { margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
        .user-avatar { width: 35px; height: 35px; background: var(--accent); border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; }

        .main-content { flex: 1; padding: 30px; overflow-y: auto; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }

        .tab-content { display: none; animation: fadeIn 0.2s ease; }
        .tab-content.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 25px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }

        /* DATA TABLES */
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; padding: 15px; border-bottom: 1px solid var(--border); }
        th { color: #888; font-size: 0.85rem; text-transform: uppercase; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
        .badge.admin { background: rgba(88, 101, 242, 0.2); color: #5865F2; }
        .badge.mod { background: rgba(34, 197, 94, 0.2); color: #22c55e; }

        .ip-box { background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; padding: 15px; border-radius: 8px; font-weight: bold; text-align: center; margin-bottom: 20px; cursor: pointer; }
        .ip-box:hover { background: rgba(239, 68, 68, 0.2); }
    </style>
</head>
<body>

    <div id="auth-overlay">
        <div class="auth-box" id="login-box">
            <h2><i class="fas fa-robot"></i> Tennessee Bot</h2>
            <div class="input-group">
                <label>Username</label>
                <input type="text" id="login-user">
            </div>
            <div class="input-group">
                <label>Password</label>
                <input type="password" id="login-pass">
            </div>
            <button class="btn" onclick="login()">Login</button>
            <button class="btn secondary" onclick="showRegister()">Create Account</button>
        </div>

        <div class="auth-box" id="register-box" style="display:none;">
            <h2>Join Team</h2>
            <div class="input-group">
                <label>New Username</label>
                <input type="text" id="reg-user">
            </div>
            <div class="input-group">
                <label>New Password</label>
                <input type="password" id="reg-pass">
            </div>
            <div class="input-group">
                <label>Invite Code</label>
                <input type="password" id="reg-code" placeholder="Ask Owner for code">
            </div>
            <button class="btn" onclick="register()">Register</button>
            <button class="btn secondary" onclick="showLogin()">Back</button>
        </div>
    </div>

    <div class="sidebar">
        <div class="brand"><i class="fas fa-shield-alt"></i> <span id="nav-server-name">Loading...</span></div>
        <div class="nav-item active" onclick="switchTab('dashboard')"><i class="fas fa-home"></i> Dashboard</div>
        <div class="nav-item" onclick="switchTab('lookup')"><i class="fas fa-search"></i> Database</div>
        <div class="nav-item" onclick="switchTab('staff')"><i class="fas fa-users"></i> Staff List</div>
        <div class="nav-item" onclick="switchTab('bans')"><i class="fas fa-gavel"></i> Ban List</div>
        <div class="nav-item" onclick="switchTab('config')"><i class="fas fa-cog"></i> Settings</div>
        <div class="nav-item" onclick="switchTab('developer')"><i class="fas fa-code"></i> Developer</div>

        <div class="user-profile">
            <div class="user-avatar" id="profile-initial">?</div>
            <div>
                <div style="font-weight:600" id="profile-name">User</div>
                <div style="font-size:0.8rem; opacity:0.7">Logged In</div>
            </div>
            <i class="fas fa-sign-out-alt" style="margin-left:auto; cursor:pointer;" onclick="logout()"></i>
        </div>
    </div>

    <div class="main-content">

        <div id="dashboard" class="tab-content active">
            <div class="header"><h1>System Overview</h1></div>

            <div class="ip-box" onclick="copyIP()" title="Click to copy">
                <i class="fas fa-key"></i> TUNNEL PASSWORD: <span id="stat-ip">Loading...</span>
            </div>

            <div class="grid">
                <div class="card"><h3>Uptime</h3><h2 id="stat-uptime">0m</h2></div>
                <div class="card"><h3>Memory</h3><h2 id="stat-memory">0MB</h2></div>
                <div class="card"><h3>Status</h3><h2 style="color:#22c55e">Active</h2></div>
            </div>
        </div>

        <div id="lookup" class="tab-content">
            <div class="header"><h1>Database Lookup</h1></div>
            <div class="card">
                <input type="text" id="lookup-input" placeholder="Username or ID..." style="margin-bottom:10px;">
                <button class="btn" onclick="performLookup()">Search</button>
                <div id="lookup-results" style="margin-top:20px;"></div>
            </div>
        </div>

        <div id="staff" class="tab-content"><div class="header"><h1>Staff List</h1><button class="btn" style="width:auto" onclick="loadStaff()">Refresh</button></div><div class="card"><table id="staff-table"></table></div></div>

        <div id="bans" class="tab-content"><div class="header"><h1>Ban List</h1><button class="btn" style="width:auto" onclick="loadBans()">Refresh</button></div><div class="card"><table id="bans-table"></table></div></div>

        <div id="config" class="tab-content">
            <div class="header"><h1>Settings</h1></div>
            <div class="card">
                <div class="input-group"><label>Server Name</label><input id="conf-name"></div>
                <div class="input-group"><label>API Key</label><input type="password" id="conf-key"></div>
                <div class="input-group"><label>Invite Code</label><input id="conf-invite"></div>
                <button class="btn" onclick="saveConfig()">Save Changes</button>
            </div>
        </div>

        <div id="developer" class="tab-content">
            <div class="header"><h1>Developer</h1></div>
            <div class="card"><h3>User Accounts</h3><div id="user-list"></div></div>
        </div>
    </div>

    <script>
        // --- 1. PERSISTENCE LOGIC (This fixes the refresh issue) ---
        window.onload = function() {
            const savedUser = localStorage.getItem('tn_user');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                document.getElementById('auth-overlay').style.display = 'none';
                initDashboard(user);

                // Restore last tab
                const lastTab = localStorage.getItem('tn_tab');
                if(lastTab) switchTab(lastTab);
            }
        };

        // --- AUTH ---
        function showRegister() { document.getElementById('login-box').style.display='none'; document.getElementById('register-box').style.display='block'; }
        function showLogin() { document.getElementById('login-box').style.display='block'; document.getElementById('register-box').style.display='none'; }

        async function login() {
            const u=document.getElementById('login-user').value, p=document.getElementById('login-pass').value;
            const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
            const d=await r.json();
            if(d.success) { 
                localStorage.setItem('tn_user', JSON.stringify(d.user)); // SAVE USER
                document.getElementById('auth-overlay').style.display='none'; 
                initDashboard(d.user); 
            } else alert(d.error);
        }

        async function register() {
            const u=document.getElementById('reg-user').value, p=document.getElementById('reg-pass').value, c=document.getElementById('reg-code').value;
            const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p,code:c})});
            const d=await r.json();
            if(d.success) { alert("Success! Please Login."); showLogin(); } else alert(d.error);
        }

        function logout(){ 
            localStorage.removeItem('tn_user'); // CLEAR USER
            localStorage.removeItem('tn_tab');
            location.reload(); 
        }

        // --- DASHBOARD ---
        function initDashboard(user) {
            document.getElementById('profile-name').innerText = user.username;
            document.getElementById('profile-initial').innerText = user.username[0].toUpperCase();

            // Hide dev tabs if not admin
            if(user.role !== 'admin') {
                // Find index of config/dev tabs and hide them (simple implementation)
                document.querySelectorAll('.nav-item')[4].style.display = 'none'; // Config
                document.querySelectorAll('.nav-item')[5].style.display = 'none'; // Dev
            }

            loadConfig(); refreshStats(); setInterval(refreshStats, 5000);
        }

        function switchTab(id) {
            localStorage.setItem('tn_tab', id); // SAVE TAB
            document.querySelectorAll('.tab-content').forEach(d=>d.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(d=>d.classList.remove('active'));
            document.getElementById(id).classList.add('active');

            // Highlight nav
            const navs = document.querySelectorAll('.nav-item');
            const map = {'dashboard':0, 'lookup':1, 'staff':2, 'bans':3, 'config':4, 'developer':5};
            if(navs[map[id]]) navs[map[id]].classList.add('active');

            if(id==='staff') loadStaff(); if(id==='bans') loadBans(); if(id==='developer') loadDev();
        }

        async function refreshStats() {
            const r=await fetch('/api/stats'); const d=await r.json();
            document.getElementById('stat-uptime').innerText=d.uptime;
            document.getElementById('stat-memory').innerText=d.memory;
            document.getElementById('stat-ip').innerText=d.ip;
        }
        function copyIP() {
            const ip = document.getElementById('stat-ip').innerText;
            navigator.clipboard.writeText(ip);
            alert("Tunnel Password Copied: " + ip);
        }

        // --- DATA ---
        async function performLookup(){ 
            const q=document.getElementById('lookup-input').value; document.getElementById('lookup-results').innerHTML='Searching...';
            const r=await fetch('/api/lookup?query='+q); const d=await r.json();
            let h=''; 
            if(d.staff) h+=\`<div style="padding:15px; background:#1e1f24; border-left:4px solid #5865F2"><b>\${d.staff.username}</b> (Staff)</div>\`;
            if(d.ban) h+=\`<div style="padding:15px; background:#1e1f24; border-left:4px solid #ef4444"><b>Banned</b>: \${d.ban.reason}</div>\`;
            if(!d.staff&&!d.ban) h='<div style="color:#22c55e">User is safe.</div>';
            document.getElementById('lookup-results').innerHTML=h;
        }
        async function loadStaff() {
            const r=await fetch('/api/staff'); const d=await r.json();
            let h='<tr><th>Rank</th><th>Name</th></tr>';
            d.forEach(u=>h+=\`<tr><td><span class="badge admin">\${u.rank}</span></td><td>\${u.username}</td></tr>\`);
            document.getElementById('staff-table').innerHTML=h||'<tr><td>None</td></tr>';
        }
        async function loadBans() {
            const r=await fetch('/api/bans'); const d=await r.json();
            let h='<tr><th>User</th><th>Reason</th></tr>';
            d.forEach(u=>h+=\`<tr><td>\${u.username||u.userId}</td><td>\${u.reason}</td></tr>\`);
            document.getElementById('bans-table').innerHTML=h||'<tr><td>None</td></tr>';
        }
        async function loadConfig() {
            const r=await fetch('/api/config'); const d=await r.json();
            document.getElementById('nav-server-name').innerText=d.serverName;
            document.getElementById('conf-name').value=d.serverName;
            document.getElementById('conf-key').value=d.erlcKey;
            document.getElementById('conf-invite').value=d.inviteCode;
        }
        async function saveConfig() {
            const b={serverName:document.getElementById('conf-name').value, erlcKey:document.getElementById('conf-key').value, inviteCode:document.getElementById('conf-invite').value};
            await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
            alert("Saved!"); loadConfig();
        }
        async function loadDev() {
            const r=await fetch('/api/dev'); const d=await r.json();
            let h=''; d.users.forEach(u=>h+=\`<div style="padding:10px; border-bottom:1px solid #333">\${u.username} (\${u.role})</div>\`);
            document.getElementById('user-list').innerHTML=h;
        }
    </script>
</body>
</html>
`;

// ==========================================
// ⚙️ BACKEND
// ==========================================
app.get("/", (req, res) => res.send(frontendHTML));

app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (password === DB.config.masterKey)
        return res.json({
            success: true,
            user: { username: "Developer", role: "admin" },
        });
    const user = DB.users.find(
        (u) => u.username === username && u.password === password,
    );
    if (user) return res.json({ success: true, user });
    res.json({ success: false, error: "Invalid credentials" });
});

app.post("/api/auth/register", (req, res) => {
    const { username, password, code } = req.body;
    if (code !== DB.config.inviteCode)
        return res.json({ success: false, error: "Invalid Invite Code" });
    if (DB.users.find((u) => u.username === username))
        return res.json({ success: false, error: "Username taken" });
    DB.users.push({ username, password, role: "mod" });
    saveDB(DB);
    res.json({ success: true });
});

app.get("/api/stats", (req, res) => {
    const u = process.uptime();
    res.json({
        uptime: `${Math.floor(u / 3600)}h ${Math.floor((u % 3600) / 60)}m`,
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        ip: PUBLIC_IP,
    });
});

app.get("/api/lookup", async (req, res) => {
    try {
        const headers = { "Server-key": DB.config.erlcKey },
            q = req.query.query;
        const [s, b] = await Promise.allSettled([
            axios.get(`${DB.config.erlcUrl}/server/staff`, { headers }),
            axios.get(`${DB.config.erlcUrl}/server/bans`, { headers }),
        ]);
        let result = { staff: null, ban: null };
        if (s.status === "fulfilled")
            Object.keys(s.value.data).forEach((r) => {
                const g = s.value.data[r];
                if (typeof g === "object" && !Array.isArray(g)) {
                    for (const [i, n] of Object.entries(g))
                        if (n.toLowerCase() === q.toLowerCase() || i === q)
                            result.staff = { rank: r, username: n };
                }
            });
        if (b.status === "fulfilled") {
            const list = Array.isArray(b.value.data)
                ? b.value.data
                : Object.values(b.value.data);
            const f = list.find(
                (x) =>
                    (x.userId && String(x.userId) === q) ||
                    (x.username &&
                        x.username.toLowerCase() === q.toLowerCase()),
            );
            if (f) result.ban = { reason: f.reason };
        }
        res.json(result);
    } catch (e) {
        res.json({ error: "API Error" });
    }
});
app.get("/api/staff", async (req, res) => {
    try {
        const r = await axios.get(`${DB.config.erlcUrl}/server/staff`, {
            headers: { "Server-key": DB.config.erlcKey },
        });
        let l = [];
        Object.keys(r.data).forEach((k) => {
            const g = r.data[k];
            if (typeof g === "object" && !Array.isArray(g))
                for (const [i, n] of Object.entries(g))
                    l.push({ rank: k, username: n });
        });
        res.json(l);
    } catch (e) {
        res.json([]);
    }
});
app.get("/api/bans", async (req, res) => {
    try {
        const r = await axios.get(`${DB.config.erlcUrl}/server/bans`, {
            headers: { "Server-key": DB.config.erlcKey },
        });
        res.json(Array.isArray(r.data) ? r.data : Object.values(r.data));
    } catch (e) {
        res.json([]);
    }
});
app.get("/api/config", (req, res) => res.json(DB.config));
app.post("/api/config", (req, res) => {
    DB.config = { ...DB.config, ...req.body };
    saveDB(DB);
    res.json({ success: true });
});
app.get("/api/dev", (req, res) => res.json({ users: DB.users }));

// ==========================================
// 🚀 LAUNCHER
// ==========================================
function keepAlive() {
    const FINAL_PORT =
        process.env.SERVER_PORT || process.env.PORT || DB.config.port;

    app.listen(FINAL_PORT, "0.0.0.0", async () => {
        try {
            const r = await axios.get("https://api.ipify.org?format=json");
            PUBLIC_IP = r.data.ip;
        } catch (e) {
            PUBLIC_IP = "Unknown";
        }

        console.log(`\n\n`);
        console.log(`██████████████████████████████████████████████`);
        console.log(`█  TENNESSEE BOT - TUNNEL PASSWORD (IP)      █`);
        console.log(`█                                            █`);
        console.log(`█           ${PUBLIC_IP}           █`);
        console.log(`█                                            █`);
        console.log(`██████████████████████████████████████████████`);
        console.log(`\n✅ Manager Online`);
        console.log(`🔑 DEV PASSWORD: ${DB.config.masterKey}`);

        const ssh = spawn("ssh", [
            "-o",
            "StrictHostKeyChecking=no",
            "-p",
            "443",
            "-R0:localhost:" + FINAL_PORT,
            "a.pinggy.io",
        ]);
        ssh.stdout.on("data", (d) => {
            const s = d.toString();
            const m = s.match(/https:\/\/[\w-]+\.pinggy\.link/);
            if (m) console.log(`🚀 PRIMARY LINK: ${m[0]}`);
        });

        try {
            const tunnel = await localtunnel({
                port: FINAL_PORT,
                subdomain: "tennessee-bot",
            });
            console.log(`🐢 BACKUP LINK:  ${tunnel.url}`);
            console.log(
                `   (Use the IP in the big box above to unlock this link)`,
            );
        } catch (e) {}
    });
}
module.exports = keepAlive;
