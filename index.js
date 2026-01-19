/**
 * =============================================================================
 * TENNESSEE STATE RP - MANAGEMENT DASHBOARD (v4.6 Enterprise)
 * =============================================================================
 * * FEATURES:
 * - Real-time ERLC API Integration
 * - Roblox User & Avatar Resolution
 * - Advanced Staff Management (Search, Filtering, Categorization)
 * - Robust Ban Management (Multi-API Support)
 * - Gallery System with Approval Workflow
 * - Secure Authentication System
 * - Responsive Dark/Red Theme
 * * =============================================================================
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();

// ==========================================
// 🛠️ CONFIGURATION & CONSTANTS
// ==========================================

// Defines the rank power. Higher number = Higher rank.
const ROLE_HIERARCHY = {
    "Owner": 100,
    "Co-Owner": 90,
    "Head Developer": 85,
    "Developer": 80,
    "Super Admin": 70,
    "Admin": 60,
    "Moderator": 50,
    "Trial Moderator": 40,
    "Tester": 30,
    "Civilian": 0
};

// Default Configuration Template
const DEFAULT_CONFIG = {
    serverName: "Tennessee State RP",
    logoUrl: "", 
    erlcKey: process.env.ERLC_KEY || "", 
    erlcUrl: "https://api.policeroleplay.community/v1",

    // AUTHENTICATION
    inviteCode: "staff2026",      
    masterKey: "owner123",

    // SERVER SETTINGS
    port: 3000,

    // HOME PAGE CONTENT
    homeTitle: "Welcome to Tennessee State RP",
    homeDesc: "The official management dashboard. Join us on Discord or launch the game directly below.",
    homeBg: "https://tr.rbxcdn.com/51357597920752538965842857418659/768/432/Image/Png",
    joinLink: "https://www.roblox.com/games/2534724415/Emergency-Response-Liberty-County",
    discordLink: "https://discord.gg/" 
};

// Database File Path
const DB_FILE = path.join(__dirname, 'dashboard_db.json');

// Global Database Cache
let DB = loadDB();

function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = { config: DEFAULT_CONFIG, users: [], gallery: [], galleryRequests: [] };
        try { fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2)); } catch(e){}
        return initialData;
    }
    const data = JSON.parse(fs.readFileSync(DB_FILE));
    data.config = { ...DEFAULT_CONFIG, ...data.config };
    if(!Array.isArray(data.gallery)) data.gallery = []; 
    if(!Array.isArray(data.galleryRequests)) data.galleryRequests = []; 
    return data;
}

function saveDB(data) {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); } catch(e){ console.error("Save Error:", e); }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 🎨 FRONTEND (HTML/CSS/JS)
// ==========================================
const frontendHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Management Dashboard</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root { 
            --bg: #050505; --sidebar: #0a0a0a; --card: #111111; 
            --border: #222222; --hover: #1f1f1f;
            --accent: #b91c1c; --accent-hover: #991b1b;
            --text: #ffffff; --text-muted: #888888;
            --success: #15803d; --discord: #5865F2;
        }
        * { box-sizing: border-box; outline: none; }
        body { margin: 0; font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }

        /* LOADING */
        #page-loader { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #000; z-index: 9999; display: flex; flex-direction: column; justify-content: center; align-items: center; transition: opacity 0.5s ease; }
        .spinner { width: 50px; height: 50px; border: 4px solid #222; border-top: 4px solid var(--accent); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* TOAST */
        #toast-container { position: fixed; bottom: 20px; right: 20px; z-index: 2000; display: flex; flex-direction: column; gap: 10px; }
        .toast { background: var(--card); border-left: 4px solid var(--text); color: white; padding: 15px 20px; border-radius: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); min-width: 250px; animation: slideIn 0.3s ease; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border); }
        .toast.success { border-left-color: var(--success); }
        .toast.error { border-left-color: var(--accent); }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        /* AUTH */
        #auth-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #000; z-index: 1000; display: flex; justify-content: center; align-items: center; }
        .auth-box { background: var(--card); padding: 40px; border-radius: 8px; border: 1px solid var(--border); width: 400px; }
        .input-group { margin-bottom: 16px; }
        .input-group label { display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 500; }
        input, select, textarea { width: 100%; padding: 12px; background: #0a0a0a; border: 1px solid var(--border); border-radius: 4px; color: white; font-family: inherit; transition: 0.2s; }
        input:focus, select:focus { border-color: var(--accent); }
        .btn { width: 100%; padding: 12px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 700; margin-top: 10px; transition: 0.2s; display: inline-flex; justify-content: center; align-items: center; gap: 8px; text-decoration: none; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px; }
        .btn:hover { background: var(--accent-hover); }

        /* LAYOUT */
        .sidebar { width: 280px; background: var(--sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 24px; flex-shrink: 0; }
        .brand { font-size: 1.25rem; font-weight: 800; color: white; display: flex; align-items: center; gap: 12px; margin-bottom: 30px; height: 50px; }
        .brand img { max-height: 40px; max-width: 100%; border-radius: 4px; }
        .nav-item { padding: 12px 16px; border-radius: 4px; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; gap: 12px; margin-bottom: 4px; transition: 0.2s; font-weight: 500; font-size: 0.9rem; }
        .nav-item:hover { background: var(--hover); color: white; }
        .nav-item.active { background: var(--accent); color: white; }
        .user-panel { margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }

        .main-content { flex: 1; padding: 40px; overflow-y: auto; background: var(--bg); }
        .tab-content { display: none; }
        .tab-content.active { display: block; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        .card { background: var(--card); border: 1px solid var(--border); border-radius: 4px; padding: 24px; margin-bottom: 20px; }

        /* DATA TABLES */
        table { width: 100%; border-collapse: separate; border-spacing: 0; }
        th { text-align: left; padding: 16px; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 700; border-bottom: 1px solid var(--border); letter-spacing: 0.05em; }
        td { padding: 16px; border-bottom: 1px solid var(--border); font-size: 0.9rem; vertical-align: middle; }
        tr:hover td { background: var(--hover); }
        .player-cell { display: flex; align-items: center; gap: 12px; }
        .table-avatar { width: 35px; height: 35px; border-radius: 4px; background: #222; object-fit: cover; }
        .badge { padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
        .badge.active { background: rgba(220, 38, 38, 0.2); color: var(--accent); border: 1px solid var(--accent); }
        .badge.expired { background: rgba(255, 255, 255, 0.1); color: #888; border: 1px solid #444; }

        /* STATUS BANNER */
        .status-banner { background: linear-gradient(90deg, var(--card) 0%, #1a0505 100%); border: 1px solid var(--border); border-left: 4px solid var(--success); border-radius: 4px; padding: 20px 30px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; }
        .status-dot { width: 10px; height: 10px; background: var(--success); border-radius: 50%; box-shadow: 0 0 10px var(--success); display:inline-block; margin-right:8px; }

        /* HERO & GALLERY */
        .hero { position: relative; background-color: #000; background-size: cover; background-position: center; padding: 80px 40px; border-radius: 4px; margin-bottom: 30px; border: 1px solid var(--border); text-align: center; overflow: hidden; }
        .hero::before { content: ''; position: absolute; top:0; left:0; right:0; bottom:0; background: linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.95)); z-index: 1; }
        .hero-content { position: relative; z-index: 2; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: var(--card); padding: 20px; border-radius: 4px; border: 1px solid var(--border); border-left: 2px solid var(--accent); }
        .stat-val { font-size: 1.8rem; font-weight: 700; color: white; margin-bottom: 5px; }
        .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; margin-top: 20px; }
        .gallery-item { aspect-ratio: 16/9; border-radius: 4px; overflow: hidden; border: 1px solid var(--border); position: relative; background: #050505; }
        .gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: 0.3s; }
        .gallery-item:hover img { transform: scale(1.05); }
        .gallery-del { position: absolute; top: 5px; right: 5px; background: var(--accent); color: white; border: none; padding: 5px 10px; border-radius: 2px; cursor: pointer; display: none; }
        .gallery-item:hover .gallery-del { display: block; }
        .btn-row { display: flex; gap: 15px; justify-content: center; margin-top: 25px; flex-wrap: wrap; }
        .btn-join { background: white; color: black; padding: 12px 30px; border-radius: 4px; text-decoration: none; font-weight: 800; display: inline-flex; align-items: center; gap: 8px; transition: transform 0.2s; text-transform: uppercase; }
        .btn-join:hover { transform: translateY(-2px); background: #eee; }
        .btn-discord { background: var(--discord); color: white; padding: 12px 30px; border-radius: 4px; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; transition: transform 0.2s; text-transform: uppercase; }
        .btn-discord:hover { background: #4752C4; transform: translateY(-2px); }
        .section-split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media(max-width: 900px) { .section-split { grid-template-columns: 1fr; } }
        .request-box { background: var(--bg); border: 1px dashed var(--border); padding: 20px; border-radius: 4px; text-align: center; margin-top: 20px; }

        /* SEARCH & FILTER BAR */
        .filter-bar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .filter-btn { background: var(--card); border: 1px solid var(--border); color: var(--text-muted); padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: 0.2s; }
        .filter-btn:hover, .filter-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
        .search-input { flex: 1; padding: 8px 12px; background: var(--card); border: 1px solid var(--border); border-radius: 4px; color: white; min-width: 200px; }
    </style>
</head>
<body>

    <div id="page-loader"><div class="spinner"></div><div style="color:white; font-weight:600; letter-spacing:2px; font-size:0.9rem">LOADING DASHBOARD</div></div>
    <div id="toast-container"></div>

    <div id="auth-overlay">
        <div class="auth-box" id="login-form">
            <h2 style="text-align:center; margin-bottom:20px; color:white; letter-spacing:1px">DASHBOARD LOGIN</h2>
            <div class="input-group"><label>Username</label><input type="text" id="user-in" onkeydown="handleEnter(event, 'login')"></div>
            <div class="input-group"><label>Password</label><input type="password" id="pass-in" onkeydown="handleEnter(event, 'login')"></div>
            <button class="btn" onclick="auth('login')">Enter</button>
            <div style="text-align:center; margin-top:15px; color:var(--text-muted); cursor:pointer; font-size:0.8rem" onclick="toggleAuth()">Create Account</div>
        </div>
        <div class="auth-box" id="reg-form" style="display:none">
            <h2 style="text-align:center; margin-bottom:20px; color:white">REGISTER</h2>
            <div class="input-group"><label>Username</label><input type="text" id="r-user" onkeydown="handleEnter(event, 'register')"></div>
            <div class="input-group"><label>Password</label><input type="password" id="r-pass" onkeydown="handleEnter(event, 'register')"></div>
            <div class="input-group"><label>Role</label>
                <select id="r-role">
                    <option value="Civilian">Civilian</option>
                    <option value="Tester">Tester</option>
                    <option value="Mod">Moderator</option>
                    <option value="Admin">Admin</option>
                    <option value="Developer">Developer</option>
                    <option value="Co-Owner">Co-Owner</option>
                    <option value="Owner">Owner</option>
                </select>
            </div>
            <div class="input-group"><label>Staff Code</label><input type="password" id="r-code" onkeydown="handleEnter(event, 'register')"></div>
            <button class="btn" onclick="auth('register')">Register</button>
            <div style="text-align:center; margin-top:15px; color:var(--text-muted); cursor:pointer; font-size:0.8rem" onclick="toggleAuth()">Back</div>
        </div>
    </div>

    <div class="sidebar">
        <div class="brand" id="brand-container"><i class="fas fa-gavel" style="color:var(--accent)"></i> <span id="brand-text">TN RP</span></div>
        <div class="nav-item active" id="nav-home" onclick="switchTab('home')"><i class="fas fa-home"></i> Home</div>
        <div class="nav-item" id="nav-bans" onclick="switchTab('bans')"><i class="fas fa-user-slash"></i> Ban Records</div>
        <div class="nav-item" id="nav-staff" onclick="switchTab('staff')"><i class="fas fa-shield-alt"></i> Staff Roster</div>
        <div class="nav-item" id="nav-settings" style="display:none" onclick="switchTab('settings')"><i class="fas fa-sliders-h"></i> Settings</div>
        <div class="user-panel">
            <div style="flex:1"><div id="u-name" style="font-weight:600">User</div><div id="u-role" style="font-size:0.75rem; color:var(--text-muted)">Role</div></div>
            <i class="fas fa-sign-out-alt" style="cursor:pointer; color:var(--accent)" onclick="logout()"></i>
        </div>
    </div>

    <div class="main-content">
        <div id="home" class="tab-content active">
            <div class="status-banner">
                <div><h2 style="margin:0; font-size:1.2rem"><span class="status-dot"></span> <span id="banner-sname">Loading...</span></h2><div style="color:var(--text-muted); font-size:0.85rem; margin-top:4px; margin-left:18px">SYSTEMS ONLINE</div></div>
                <button class="btn" style="width:auto; margin:0; background:var(--card); border:1px solid var(--border)" onclick="switchTab('staff')">View Staff</button>
            </div>
            <div class="hero" id="hero-bg">
                <div class="hero-content">
                    <h1 id="hero-title" style="font-size: 3rem; margin-bottom: 10px; text-transform: uppercase; font-weight:800">Welcome</h1>
                    <p id="hero-desc" style="color: #ccc; max-width: 600px; margin: 0 auto; line-height: 1.5; font-size: 1.1rem;">...</p>
                    <div class="btn-row">
                        <a id="btn-join" href="#" target="_blank" class="btn-join"><i class="fas fa-play"></i> Launch Game</a>
                        <a id="btn-discord" href="#" target="_blank" class="btn-discord"><i class="fab fa-discord"></i> Discord</a>
                    </div>
                </div>
            </div>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-val" id="stat-bans">0</div><div style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase">Total Bans</div></div>
                <div class="stat-card"><div class="stat-val" id="stat-staff">0</div><div style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase">Staff Count</div></div>
                <div class="stat-card"><div class="stat-val" style="color:var(--success)">Online</div><div style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase">API Status</div></div>
            </div>
            <div class="card">
                <h3 style="margin-top:0; border-bottom:1px solid var(--border); padding-bottom:15px; color:white"><i class="fas fa-images"></i> SERVER GALLERY</h3>
                <div id="home-gallery" class="gallery-grid"><p style="color:var(--text-muted)">No images added.</p></div>
                <div class="request-box">
                    <h4 style="margin-top:0">Have a cool screenshot?</h4>
                    <div style="display:flex; gap:10px; max-width:500px; margin:10px auto;">
                        <input id="req-img" placeholder="Paste Image URL here..." style="flex:1" onkeydown="handleEnter(event, 'request')">
                        <button class="btn" style="width:auto; margin:0;" onclick="submitRequest()">Submit</button>
                    </div>
                    <small style="color:var(--text-muted)">Admins will review your photo before it appears.</small>
                </div>
            </div>
        </div>

        <div id="bans" class="tab-content">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px"><h1>BAN RECORDS</h1><button class="btn" style="width:auto" onclick="fetchBans()">Refresh</button></div>
            <div class="card">
                <input type="text" id="ban-search" style="width:100%; padding:12px; background:#050505; border:1px solid #333; color:white; border-radius:4px" placeholder="Search bans by Name or ID..." onkeyup="filterBans()">
                <div style="overflow-x:auto"><table style="margin-top:20px"><thead><tr><th>Player</th><th>User ID</th><th>Status</th><th>Ban Date</th><th>Expires</th></tr></thead><tbody id="ban-list"></tbody></table></div>
                <div class="pagination">
                    <button class="btn" style="width:auto; background:var(--card)" id="pBtn" onclick="changePage(-1)">Prev</button>
                    <span id="pageSpan" style="color:var(--text-muted); margin:0 15px">Page 1</span>
                    <button class="btn" style="width:auto; background:var(--card)" id="nBtn" onclick="changePage(1)">Next</button>
                </div>
            </div>
        </div>

        <div id="staff" class="tab-content">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px"><h1>STAFF ROSTER</h1><button class="btn" style="width:auto" onclick="fetchStaff()">Refresh</button></div>
            <div class="filter-bar">
                <input type="text" class="search-input" id="staff-search" placeholder="Search Name or ID..." onkeyup="filterStaffRender()">
                <button class="filter-btn active" onclick="setStaffFilter('All', this)">All</button>
                <button class="filter-btn" onclick="setStaffFilter('High Command', this)">High Command</button>
                <button class="filter-btn" onclick="setStaffFilter('Administration', this)">Administration</button>
                <button class="filter-btn" onclick="setStaffFilter('Moderation', this)">Moderation</button>
            </div>
            <div id="staff-container"></div>
        </div>

        <div id="settings" class="tab-content">
            <h1>SETTINGS</h1>
            <div class="section-split">
                <div class="card">
                    <h3 style="margin-top:0; color:white">Config</h3>
                    <div class="input-group"><label>Server Name</label><input id="c-sname"></div>
                    <div class="input-group"><label>Logo URL</label><input id="c-logo"></div>
                    <div class="input-group"><label>ERLC API Key</label><input type="password" id="c-key" placeholder="Enter key here to fix stats"></div>
                    <div class="input-group"><label>Staff Code</label><input id="c-code"></div>
                    <div class="input-group"><label>Discord Link</label><input id="c-dlink"></div>
                </div>
                <div class="card">
                    <h3 style="margin-top:0; color:white">Visuals</h3>
                    <div class="input-group"><label>Title</label><input id="c-htitle"></div>
                    <div class="input-group"><label>Description</label><textarea id="c-hdesc" rows="3"></textarea></div>
                    <div class="input-group"><label>Background Image</label><input id="c-hbg"></div>
                    <div class="input-group"><label>Game Link</label><input id="c-jlink"></div>
                </div>
            </div>
            <div class="card"><h3 style="margin-top:0; color:white">Pending Gallery Requests</h3><div id="request-list" class="gallery-grid"><p style="color:var(--text-muted)">No pending requests.</p></div></div>
            <div class="card">
                <h3 style="margin-top:0; color:white">Active Gallery Images</h3>
                <div style="display:flex; gap:10px; margin-bottom:15px"><input id="new-img" placeholder="Paste Image URL here..." style="flex:1" onkeydown="handleEnter(event, 'gallery')"><button class="btn" style="width:auto; margin-top:0" onclick="addGalleryImage()">Add Direct</button></div>
                <div id="settings-gallery" class="gallery-grid"></div>
            </div>
            <button class="btn" onclick="saveConfig()" style="width:200px; margin-bottom:40px">Save Changes</button>
        </div>
    </div>

    <script>
        const ROLE_HIERARCHY = { "Owner": 5, "Co-Owner": 5, "Developer": 4, "Admin": 3, "Mod": 2, "Tester": 1, "Civilian": 0 };
        let bans = [], filteredBans = [], page = 1;
        let gallery = [], requests = [], allStaff = [], currentStaffFilter = 'All';

        function notify(msg, type = 'success') {
            const c = document.getElementById('toast-container');
            const d = document.createElement('div');
            d.className = 'toast ' + type;
            d.innerHTML = (type==='error'?'<i class="fas fa-exclamation-circle"></i> ':'<i class="fas fa-check-circle"></i> ') + msg;
            c.appendChild(d);
            setTimeout(() => { d.style.opacity = '0'; setTimeout(()=>d.remove(),300); }, 4000);
        }

        function handleEnter(e, type) {
            if(e.key === 'Enter') {
                if(type === 'login') auth('login');
                if(type === 'register') auth('register');
                if(type === 'gallery') addGalleryImage();
                if(type === 'request') submitRequest();
            }
        }

        window.onload = async () => {
            const loader = document.getElementById('page-loader');
            try {
                const sess = localStorage.getItem('tn_user');
                if(sess) {
                    const user = JSON.parse(sess);
                    document.getElementById('u-name').innerText = user.username;
                    document.getElementById('u-role').innerText = user.role;
                    updateNav(user.role);
                    document.getElementById('auth-overlay').style.display = 'none';
                    await Promise.all([loadAllConfig(), fetchBans(true), fetchStaff(true), loadRequests()]);
                }
            } catch(e) { console.error("Load error:", e); }
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
        };

        function updateNav(role) {
            const level = ROLE_HIERARCHY[role] || 0;
            document.getElementById('nav-home').style.display = 'flex';
            document.getElementById('nav-bans').style.display = level >= 1 ? 'flex' : 'none';
            document.getElementById('nav-staff').style.display = level >= 1 ? 'flex' : 'none';
            document.getElementById('nav-settings').style.display = level >= 5 ? 'flex' : 'none';
        }

        function toggleAuth() {
            const l = document.getElementById('login-form'), r = document.getElementById('reg-form');
            if(l.style.display==='none'){ l.style.display='block'; r.style.display='none'; } else { l.style.display='none'; r.style.display='block'; }
        }
        async function auth(t) {
            const d = t==='login' ? {u:document.getElementById('user-in').value,p:document.getElementById('pass-in').value} : {u:document.getElementById('r-user').value,p:document.getElementById('r-pass').value,r:document.getElementById('r-role').value,c:document.getElementById('r-code').value};
            try { 
                const r=await fetch('/api/auth/'+t,{method:'POST',body:JSON.stringify(d),headers:{'Content-Type':'application/json'}}); 
                const j=await r.json();
                if(j.ok){ localStorage.setItem('tn_user',JSON.stringify(j.user)); location.reload(); } else notify(j.msg, 'error');
            } catch(e){ notify('Connection Error', 'error'); }
        }
        function logout() { localStorage.removeItem('tn_user'); location.reload(); }
        function switchTab(id) {
            document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(e=>e.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            document.getElementById('nav-'+id).classList.add('active');
        }

        async function loadAllConfig() {
            try {
                const res = await fetch('/api/config');
                const d = await res.json();
                const brand = document.getElementById('brand-container');
                if(d.logoUrl && d.logoUrl.trim() !== "") brand.innerHTML = '<img src="'+d.logoUrl+'" alt="Logo">';
                else document.getElementById('brand-text').innerText = d.serverName;
                document.getElementById('banner-sname').innerText = d.serverName;
                document.getElementById('hero-title').innerText = d.homeTitle;
                document.getElementById('hero-desc').innerText = d.homeDesc;
                if(d.homeBg) document.getElementById('hero-bg').style.backgroundImage = 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.9)), url('+d.homeBg+')';
                document.getElementById('btn-join').href = d.joinLink;
                document.getElementById('btn-discord').href = d.discordLink;
                document.getElementById('c-sname').value = d.serverName;
                document.getElementById('c-logo').value = d.logoUrl || "";
                document.getElementById('c-code').value = d.inviteCode;
                document.getElementById('c-dlink').value = d.discordLink;
                document.getElementById('c-htitle').value = d.homeTitle;
                document.getElementById('c-hdesc').value = d.homeDesc;
                document.getElementById('c-hbg').value = d.homeBg;
                document.getElementById('c-jlink').value = d.joinLink;
                gallery = d.gallery || [];
                renderGallery();
            } catch(e) {}
        }

        function renderGallery() {
            const html = gallery.map(url => '<div class="gallery-item"><img src="'+url+'"></div>').join('');
            document.getElementById('home-gallery').innerHTML = html || '<p style="color:var(--text-muted)">No images added.</p>';
            const editHtml = gallery.map((url, i) => '<div class="gallery-item"><img src="'+url+'"><button class="gallery-del" onclick="delImg('+i+')"><i class="fas fa-trash"></i></button></div>').join('');
            document.getElementById('settings-gallery').innerHTML = editHtml;
        }

        async function submitRequest() {
            const url = document.getElementById('req-img').value;
            if(!url) return;
            await fetch('/api/gallery/request', { method: 'POST', body: JSON.stringify({ url }), headers: {'Content-Type': 'application/json'} });
            notify("Request Submitted for Review!", "success");
            document.getElementById('req-img').value = '';
        }

        async function loadRequests() {
            try {
                const res = await fetch('/api/gallery/requests');
                requests = await res.json();
                const html = requests.map((url, i) => \`
                    <div class="gallery-item">
                        <img src="\${url}">
                        <div style="position:absolute; bottom:0; width:100%; display:flex;">
                            <button onclick="manageReq('\${url}', true)" style="flex:1; background:var(--success); border:none; color:white; padding:5px; cursor:pointer"><i class="fas fa-check"></i></button>
                            <button onclick="manageReq('\${url}', false)" style="flex:1; background:var(--accent); border:none; color:white; padding:5px; cursor:pointer"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                \`).join('');
                document.getElementById('request-list').innerHTML = html || '<p style="color:var(--text-muted)">No pending requests.</p>';
            } catch(e) {}
        }

        async function manageReq(url, approve) {
            await fetch('/api/gallery/manage', { method: 'POST', body: JSON.stringify({ url, approve }), headers: {'Content-Type': 'application/json'} });
            loadRequests();
            loadAllConfig(); 
            notify(approve ? "Image Approved" : "Image Rejected", approve ? "success" : "error");
        }

        function addGalleryImage() {
            const url = document.getElementById('new-img').value;
            if(url) { gallery.push(url); document.getElementById('new-img').value=''; renderGallery(); notify("Image Added! Please Save.", "success"); }
        }
        function delImg(i) { gallery.splice(i, 1); renderGallery(); }

        async function saveConfig() {
            const data = { 
                serverName: document.getElementById('c-sname').value, 
                logoUrl: document.getElementById('c-logo').value, 
                erlcKey: document.getElementById('c-key').value, 
                inviteCode: document.getElementById('c-code').value,
                discordLink: document.getElementById('c-dlink').value,
                homeTitle: document.getElementById('c-htitle').value,
                homeDesc: document.getElementById('c-hdesc').value,
                homeBg: document.getElementById('c-hbg').value,
                joinLink: document.getElementById('c-jlink').value,
                gallery: gallery
            };
            await fetch('/api/config', { method: 'POST', body: JSON.stringify(data), headers: {'Content-Type': 'application/json'} });
            notify("Saved Successfully!");
            setTimeout(() => location.reload(), 1000);
        }

        async function fetchStats() {
            try {
                const res = await fetch('/api/stats');
                const data = await res.json();
                document.getElementById('stat-bans').innerText = data.banCount;
                document.getElementById('stat-staff').innerText = data.staffCount;
            } catch(e) {}
        }

        async function fetchBans(silent = false) {
            const btn = document.querySelector('#bans button');
            if(!silent && btn) btn.innerText = "Loading...";

            try {
                const res = await fetch('/api/bans'); 
                bans = await res.json(); 
                if(!Array.isArray(bans)) throw new Error("API Error");

                filteredBans = [...bans]; 
                renderBans();

                document.getElementById('stat-bans').innerText = bans.length;
            } catch(e){ 
                if(!silent) notify("Failed to fetch Bans.", "error"); 
                document.getElementById('ban-list').innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--accent)">Unable to load data. API Error.</td></tr>';
            }
            if(!silent && btn) btn.innerHTML = '<i class="fas fa-sync"></i> Refresh';
        }

        function filterBans() {
            const q = document.getElementById('ban-search').value.toLowerCase();
            filteredBans = bans.filter(b => b.player.toLowerCase().includes(q) || b.playerId.toString().includes(q));
            page = 1; renderBans();
        }

        function renderBans() {
            if(filteredBans.length === 0) {
                 document.getElementById('ban-list').innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px">No bans found.</td></tr>';
                 return;
            }
            const start = (page-1)*20; const chunk = filteredBans.slice(start, start+20);
            let h = '';
            chunk.forEach(b => {
                const img = b.avatar || 'https://tr.rbxcdn.com/53eb9b17fe1432a801963283bc9a7218/150/150/AvatarHeadshot/Png';
                let dateStr = "Unknown";
                if(b.createdAt) {
                    const date = new Date(typeof b.createdAt === 'string' ? b.createdAt : b.createdAt * 1000);
                    if(!isNaN(date.getTime())) dateStr = date.toLocaleDateString();
                }

                h += '<tr><td><div class="player-cell"><img src="'+img+'" class="table-avatar"><div><div style="font-weight:600">'+b.player+'</div></div></div></td>';
                h += '<td><code style="color:var(--text-muted)">'+(b.playerId||'Unknown')+'</code></td>';
                h += '<td>'+(b.active ? '<span class="badge active">Active</span>' : '<span class="badge expired">Expired</span>')+'</td>';
                h += '<td>'+dateStr+'</td>';
                h += '<td>'+(b.expires || 'Never')+'</td></tr>';
            });
            document.getElementById('ban-list').innerHTML = h;
            document.getElementById('pageSpan').innerText = "Page " + page;
            document.getElementById('pBtn').disabled = page === 1;
            document.getElementById('nBtn').disabled = start + 20 >= filteredBans.length;
        }
        function changePage(d) { page += d; renderBans(); }

        async function fetchStaff(silent = false) {
            const btn = document.querySelector('#staff button');
            if(!silent && btn) btn.innerText = "Loading...";

            try {
                const res = await fetch('/api/staff'); 
                allStaff = await res.json();
                filterStaffRender();
                let count = 0;
                for(let rank in allStaff) count += allStaff[rank].length;
                document.getElementById('stat-staff').innerText = count;
            } catch(e) {
                document.getElementById('staff-container').innerHTML = '<div class="card" style="text-align:center; color:var(--text-muted)">Unable to load Staff Roster. Check API Key.</div>';
            }
            if(!silent && btn) btn.innerHTML = '<i class="fas fa-sync"></i> Refresh';
        }

        function setStaffFilter(filterName, btn) {
            currentStaffFilter = filterName;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            if(btn) btn.classList.add('active');
            filterStaffRender();
        }

        function filterStaffRender() {
            const q = document.getElementById('staff-search').value.toLowerCase();
            const container = document.getElementById('staff-container');
            let html = '';

            const highCommand = ["owner", "co-owner", "co owner", "coowner", "head developer", "developer"];
            const admin = ["super admin", "admin"];
            const mod = ["moderator", "trial moderator", "tester"];

            for(const [rank, members] of Object.entries(allStaff)) {
                const rankLower = rank.toLowerCase();
                let matchesTab = false;
                if(currentStaffFilter === 'All') matchesTab = true;
                else if(currentStaffFilter === 'High Command' && highCommand.some(r => rankLower.includes(r))) matchesTab = true;
                else if(currentStaffFilter === 'Administration' && admin.some(r => rankLower.includes(r))) matchesTab = true;
                else if(currentStaffFilter === 'Moderation' && mod.some(r => rankLower.includes(r))) matchesTab = true;

                if(!matchesTab) continue;

                const matchingMembers = members.filter(m => m.user.toLowerCase().includes(q) || m.id.toString().includes(q));

                if(matchingMembers.length > 0) {
                    html += '<div style="margin-bottom:30px"><div style="font-weight:700; color:white; margin-bottom:12px; border-left:4px solid var(--accent); padding-left:10px; text-transform:uppercase; letter-spacing:1px">'+rank+' <span style="color:var(--text-muted); font-weight:400">('+matchingMembers.length+')</span></div><div class="card" style="padding:0"><table>';
                    matchingMembers.forEach(m => {
                        const img = m.avatar || 'https://tr.rbxcdn.com/53eb9b17fe1432a801963283bc9a7218/150/150/AvatarHeadshot/Png';
                        html += '<tr><td style="display:flex; align-items:center; gap:12px"><img src="'+img+'" class="table-avatar"><span style="font-weight:600">'+m.user+'</span><span style="margin-left:auto; color:var(--text-muted); font-family:monospace; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:4px">'+m.id+'</span></td></tr>';
                    });
                    html += '</table></div></div>';
                }
            }
            container.innerHTML = html || '<div style="padding:20px; text-align:center; color:var(--text-muted)">No staff found matching criteria.</div>';
        }
    </script>
</body>
</html>
`;

// ==========================================
// ⚙️ BACKEND API & LOGIC
// ==========================================

async function enrichWithRobloxData(items, idKey) {
    if(!items || items.length === 0) return items;
    const ids = [...new Set(items.map(i => {
        const val = parseInt(i[idKey]);
        return (val && val > 0) ? val : null;
    }).filter(x => x !== null))];
    if(ids.length === 0) return items;

    const map = {};
    ids.forEach(id => map[id] = { avatar: null, name: null });

    const chunkSize = 10; 
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        try {
            const [avatarRes, userRes] = await Promise.allSettled([
                axios.get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${chunk.join(',')}&size=150x150&format=Png&isCircular=false`, { timeout: 3000 }),
                axios.post(`https://users.roblox.com/v1/users`, { userIds: chunk, excludeBannedUsers: false }, { timeout: 3000 })
            ]);

            if(avatarRes.status === 'fulfilled' && avatarRes.value.data.data) {
                avatarRes.value.data.data.forEach(obj => { if(map[obj.targetId]) map[obj.targetId].avatar = obj.imageUrl; });
            }
            if(userRes.status === 'fulfilled' && userRes.value.data.data) {
                userRes.value.data.data.forEach(obj => { if(map[obj.id]) map[obj.id].name = obj.name; });
            }
        } catch(e) { console.error("Roblox API Warn:", e.message); }
    }

    return items.map(item => {
        const id = parseInt(item[idKey]);
        if(map[id]) {
            return { 
                ...item, 
                avatar: map[id].avatar, 
                user: map[id].name || item.user || item.player,
                player: map[id].name || item.player || item.user
            };
        }
        return item;
    });
}

app.post('/api/auth/register', (req, res) => {
    const { u, p, r, c } = req.body;
    if (DB.users.find(x => x.username === u)) return res.json({ ok: false, msg: "User exists" });
    let assignedRole = "Civilian";
    if (ROLE_HIERARCHY[r] > 0) {
        if (c !== DB.config.inviteCode && p !== DB.config.masterKey) return res.json({ ok: false, msg: "Invalid Code" });
        assignedRole = r;
    }
    DB.users.push({ username: u, password: p, role: assignedRole });
    saveDB(DB);
    res.json({ ok: true, user: { username: u, role: assignedRole } });
});

app.post('/api/auth/login', (req, res) => {
    const { u, p } = req.body;
    const user = DB.users.find(x => x.username === u && x.password === p);
    if (user || p === DB.config.masterKey) return res.json({ ok: true, user: user || { username: "Master", role: "Owner" } });
    res.json({ ok: false, msg: "Invalid credentials" });
});

app.get('/api/stats', async (req, res) => {
    try {
        const [banRes, staffRes] = await Promise.allSettled([
            axios.get(`https://api.eryn.io/v1/bans`, { timeout: 4000 }), 
            (DB.config.erlcKey ? axios.get(`${DB.config.erlcUrl}/server/staff`, { headers: { 'Server-Key': DB.config.erlcKey }, timeout: 4000 }) : Promise.resolve({ data: {} }))
        ]);

        let banCount = 0;
        if(banRes.status === 'fulfilled' && Array.isArray(banRes.value.data)) {
             banCount = banRes.value.data.length;
        }

        let staffCount = 0;
        if(staffRes.status === 'fulfilled' && staffRes.value.data) {
            const s = staffRes.value.data;
            for(const k in s) {
                if(Array.isArray(s[k])) staffCount += s[k].length;
                else if(typeof s[k] === 'object') staffCount += Object.keys(s[k]).length;
            }
        }
        res.json({ banCount, staffCount });
    } catch(e) { res.json({ banCount: 0, staffCount: 0 }); }
});

app.get('/api/staff', async (req, res) => {
    try {
        if(!DB.config.erlcKey) return res.json({});
        const r = await axios.get(`${DB.config.erlcUrl}/server/staff`, { headers: { 'Server-Key': DB.config.erlcKey }, timeout: 5000 });

        let flatList = [];
        let rawStructure = r.data || {};

        for (const [rank, users] of Object.entries(rawStructure)) {
            if(Array.isArray(users)) {
                users.forEach(u => {
                    const uid = parseInt(u.id || u.Id || u.userId || u.UserId || u.PlayerId || 0);
                    const uname = u.username || u.Username || u.Name || "Unknown";
                    flatList.push({ rank, id: uid, user: uname });
                });
            } else if(typeof users === 'object') {
                for (const [id, username] of Object.entries(users)) {
                    flatList.push({ rank, id: parseInt(id), user: username });
                }
            }
        }

        const enrichedList = await enrichWithRobloxData(flatList, 'id');

        let structure = {};
        const order = ["Owner", "Co-Owner", "Head Developer", "Developer", "Super Admin", "Admin", "Moderator", "Trial Moderator", "Tester"];
        const sortedKeys = Object.keys(rawStructure).sort((a,b) => {
            let ia = order.indexOf(a), ib = order.indexOf(b);
            if(ia === -1) ia = 999; if(ib === -1) ib = 999;
            return ia - ib;
        });

        sortedKeys.forEach(rank => {
            structure[rank] = enrichedList.filter(u => u.rank === rank);
        });

        res.json(structure);
    } catch (e) { res.json({}); }
});

app.get('/api/bans', async (req, res) => {
    try {
        let banList = [];
        // 1. Try ERLC API First
        if (DB.config.erlcKey) {
            try {
                const r = await axios.get(`${DB.config.erlcUrl}/server/bans`, { headers: { 'Server-Key': DB.config.erlcKey }, timeout: 4000 });
                const raw = r.data;
                const normalizer = (b, key) => ({
                    player: b.Player || b.username || b.user || "Unknown",
                    playerId: parseInt(b.UserId || b.userId || b.PlayerId || key || 0),
                    banId: b.BanId || b.banId || "N/A",
                    createdAt: b.Timestamp || b.createdAt || 0,
                    expires: b.Expires || b.expires || null,
                    active: true
                });

                if (Array.isArray(raw)) {
                    banList = raw.map(b => normalizer(b, 0));
                } else if (typeof raw === 'object') {
                    for (const [id, val] of Object.entries(raw)) {
                        banList.push(normalizer(val, id));
                    }
                }
            } catch(e) { console.log("ERLC Ban API Failed, attempting fallback..."); }
        }

        // 2. If Empty, Try Eryn
        if (banList.length === 0) {
            try {
                const r = await axios.get(`https://api.eryn.io/v1/bans`, { timeout: 4000 });
                if(Array.isArray(r.data)) {
                    banList = r.data.map(b => ({
                        player: b.user || "Unknown",
                        playerId: parseInt(b.userId || 0),
                        banId: b.banId || "N/A",
                        createdAt: b.createdAt ? Math.floor(new Date(b.createdAt).getTime() / 1000) : 0,
                        expires: b.expires || null,
                        active: b.active ?? true
                    }));
                }
            } catch(e) { console.log("Eryn API also failed."); }
        }

        const enriched = await enrichWithRobloxData(banList, 'playerId');
        res.json(enriched.sort((a,b) => (b.createdAt||0) - (a.createdAt||0)));
    } catch (e) { res.json([]); }
});

app.get('/api/gallery/requests', (req, res) => res.json(DB.galleryRequests || []));

app.post('/api/gallery/request', (req, res) => {
    if(req.body.url) {
        if(!DB.galleryRequests) DB.galleryRequests = [];
        DB.galleryRequests.push(req.body.url);
        saveDB(DB);
        res.json({ ok: true });
    }
});

app.post('/api/gallery/manage', (req, res) => {
    const { url, approve } = req.body;
    if(!DB.galleryRequests) DB.galleryRequests = [];
    DB.galleryRequests = DB.galleryRequests.filter(u => u !== url);
    if(approve) {
        if(!DB.gallery) DB.gallery = [];
        DB.gallery.push(url);
    }
    saveDB(DB);
    res.json({ ok: true });
});

app.get('/api/config', (req, res) => res.json({ ...DB.config, gallery: DB.gallery }));

app.post('/api/config', (req, res) => {
    const d = req.body;
    if(Array.isArray(d.gallery)) { DB.gallery = d.gallery; delete d.gallery; }
    if(d.erlcKey === "") delete d.erlcKey; 
    DB.config = { ...DB.config, ...d };
    saveDB(DB);
    res.json({ ok: true });
});

app.get('/', (req, res) => res.send(frontendHTML));

app.listen(3000, '0.0.0.0', () => console.log("System Online on Port 3000"));