const express = require('express');
const app = express();
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');

// ==========================================
// 1. CONFIGURATION & SETUP
// ==========================================
const PORT = process.env.PORT || 3000;

// Configuration Keys
const ERLC_API_KEY = process.env.ERLC_KEY; 
const ERLC_API_BASE = "https://api.policeroleplay.community/v1/server";

// Role Codes
const SIGNUP_CODES = {
    "TSRP_OWNER_ACCESS": "owner",
    "TSRP_ADMIN_2024": "admin",
    "TSRP_DEV_SECRET": "developer",
    "TSRP_STAFF_JOIN": "mod",
    "TSRP_CO_OWNER": "co-owner",
    "TSRP_MANAGER": "manager"
};

// File Paths
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'public')) ? path.join(__dirname, 'public') : __dirname;
const USERS_FILE = path.join(__dirname, 'users.json');
const CONTENT_FILE = path.join(__dirname, 'content.json');
const BANS_FILE = path.join(__dirname, 'bans.json');

// Queues
let commandQueue = [];
let messageQueue = [];

// ==========================================
// 2. MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// ==========================================
// 3. FILE HELPER FUNCTIONS
// ==========================================
const getUsers = () => {
    try {
        if (!fs.existsSync(USERS_FILE)) {
            const defaults = [{ user: "owner", pass: "123", role: "owner" }];
            fs.writeFileSync(USERS_FILE, JSON.stringify(defaults, null, 2));
            return defaults;
        }
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) { return []; }
};

const getBansFromFile = () => {
    try {
        if (!fs.existsSync(BANS_FILE)) return [];
        return JSON.parse(fs.readFileSync(BANS_FILE, 'utf8'));
    } catch (e) { return []; }
};

const saveBansToFile = (data) => {
    try { fs.writeFileSync(BANS_FILE, JSON.stringify(data, null, 2)); } 
    catch (e) { console.error("Error saving bans:", e); }
};

const authenticate = (username, password) => {
    const users = getUsers();
    return users.find(u => u.user === username && u.pass === password);
};

// ==========================================
// 4. MAILBOX SYSTEM
// ==========================================
app.post('/pickup', (req, res) => {
    const task = req.body;
    if (!task) return res.status(400).json({error: "No data"});
    commandQueue.push(task);
    res.json({ status: "queued", message: "Command stored in mailbox" });
});

app.get('/pickup', (req, res) => {
    res.json({ messages: commandQueue });
    commandQueue = []; 
});

// ==========================================
// 5. WEBSITE API ENDPOINTS
// ==========================================

// --- CONTENT MANAGEMENT ---
app.get('/api/content', (req, res) => {
    if (!fs.existsSync(CONTENT_FILE)) {
        return res.json({ 
            hero: { title: "Welcome", subtitle: "Server Online", statusColor: "#00ff00" }, 
            features: [], 
            gallery: [] 
        });
    }
    fs.readFile(CONTENT_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Failed to read file" });
        try { res.json(JSON.parse(data)); } catch (e) { res.json({}); }
    });
});

app.post('/api/content', (req, res) => {
    const newData = req.body;
    if (!newData || typeof newData !== 'object') {
        return res.status(400).json({ success: false, message: "Invalid data format" });
    }
    fs.writeFile(CONTENT_FILE, JSON.stringify(newData, null, 2), (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, message: "Content saved" });
    });
});

// --- ADMIN ACTIONS ---
app.post('/api/admin/action', (req, res) => {
    const { action } = req.body;
    messageQueue.push({ type: 'system', command: action, admin: req.headers.username || "WebConsole" });
    res.json({ success: true });
});

app.post('/api/command-user', (req, res) => {
    const { command, targetId } = req.body; 
    messageQueue.push({ type: 'moderation', command: command, targetId: targetId, admin: req.headers.username || "WebConsole" });
    res.json({ success: true });
});

// ==========================================
// [FIXED] PUBLIC STATS ENDPOINT (Needed for Home Page)
// ==========================================
app.get('/api/erlc-stats', async (req, res) => {
    try {
        if (!ERLC_API_KEY) return res.status(500).json({ error: 'Server Key Missing' });

        const response = await axios.get(`${ERLC_API_BASE}/players`, { 
            headers: { "Server-Key": ERLC_API_KEY },
            timeout: 5000 
        });

        // Ensure we send back an array
        const players = Array.isArray(response.data) ? response.data : [];
        res.json(players);

    } catch (e) { 
        console.error("Public Stats Error:", e.message);
        res.status(500).json([]); 
    }
});

// ==========================================
// IMPROVED ERLC PROXY (Handles 502/Offline)
// ==========================================

// 1. Public Stats (For the Home Page)
app.get('/api/erlc-stats', async (req, res) => {
    try {
        if (!ERLC_API_KEY) return res.json([]); // No key = 0 players

        const response = await axios.get(`${ERLC_API_BASE}/players`, { 
            headers: { "Server-Key": ERLC_API_KEY },
            timeout: 5000 
        });

        res.json(response.data);

    } catch (e) {
        // If error is 502 or 503, the server is just offline/sleeping.
        if (e.response && (e.response.status === 502 || e.response.status === 503)) {
            // console.log("⚠️ ERLC Server is Offline (0 Players)"); // Optional: Uncomment to see in console
            return res.json([]); // Return empty list so site shows 0 instead of crashing
        }

        console.error("❌ Stats Error:", e.message);
        res.json([]); // Fail safe to 0 players
    }
});

// 2. Admin Stats (For the Dashboard)
app.get('/api/admin/stats', async (req, res) => {
    const { username, password } = req.headers;
    if (!authenticate(username, password)) return res.status(401).json({ success: false });

    const uptimeSec = process.uptime();
    const h = Math.floor(uptimeSec / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);

    let gameData = { status: "Offline", players: [] };

    if (ERLC_API_KEY) {
        try {
            const playersRes = await axios.get(`${ERLC_API_BASE}/players`, { 
                headers: { "Server-Key": ERLC_API_KEY },
                timeout: 3000
            });

            // If we get data, the server is Online
            if (playersRes.data) {
                gameData.status = "Online";
                gameData.players = playersRes.data;
            }
        } catch (err) {
            // 502/503 means Offline. Anything else is an error.
            if (err.response && (err.response.status === 502 || err.response.status === 503)) {
                gameData.status = "Offline"; 
            } else {
                console.error("Admin Stats Fetch Error:", err.message);
                gameData.status = "Error";
            }
        }
    }

    res.json({
        system: { uptime: `${h}h ${m}m`, memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB" },
        game: gameData,
        totalBans: getBansFromFile().length
    });
});

// --- BANS & AVATARS ---
app.get('/api/bans', async (req, res) => {
    try {
        if (!ERLC_API_KEY) throw new Error("No Key");

        // 1. Get the list of currently banned users from ERLC
        const response = await axios.get(`${ERLC_API_BASE}/bans`, { 
            headers: { "Server-Key": ERLC_API_KEY } 
        });

        let apiData = response.data;
        let liveBanList = [];

        // 2. Format ERLC data (it sometimes sends an Array, sometimes an Object)
        if (Array.isArray(apiData)) {
            liveBanList = apiData;
        } else if (typeof apiData === 'object') {
            liveBanList = Object.entries(apiData).map(([id, name]) => ({ 
                UserId: id, 
                User: name 
            }));
        }

        // 3. Get your local logs (This file has the Dates, Reasons, and Mods)
        const localLogs = getBansFromFile(); 

        // 4. Create a quick lookup map using UserId
        const localDetails = {};
        localLogs.forEach(log => {
            if (log.UserId) {
                localDetails[log.UserId] = {
                    Reason: log.Reason,
                    Moderator: log.Moderator,
                    Date: log.Date,
                    Avatar: log.Avatar
                };
            }
        });

        // 5. Merge the data
        // We take the "Live" list (so we know who is actually banned)
        // and fill in the blanks using your local file.
        const finalBanList = liveBanList.map(ban => {
            const details = localDetails[ban.UserId];

            return {
                UserId: ban.UserId,
                User: ban.User, // Always use the username from the API (most current)

                // If found in local file, use that info. If not, use defaults.
                Reason: details ? details.Reason : "Banned In-Game / Reason Unknown",
                Moderator: details ? details.Moderator : "Unknown",
                Date: details ? details.Date : "Unknown",
                Avatar: details ? details.Avatar : null
            };
        });

        res.json({ bans: finalBanList });

    } catch (e) {
        console.error("Error fetching bans:", e.message);
        // Fallback: If API fails, just show local file
        res.json({ bans: getBansFromFile() });
    }
});

app.post('/api/fetch-avatars', async (req, res) => {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds)) return res.json({});

    const currentBans = getBansFromFile();
    let imageCache = {};

    currentBans.forEach(b => {
        if (b.UserId && b.Avatar) imageCache[b.UserId] = b.Avatar;
    });

    const DEFAULT_GREY_IMG = "https://tr.rbxcdn.com/53eb9b17fe1432a809c73a13889b5006/150/150/Image/Png";
    let missingIds = userIds.filter(id => {
        const saved = imageCache[id];
        return !saved || saved === DEFAULT_GREY_IMG || saved.includes("150/150");
    });

    if (missingIds.length > 0) {
        try {
            const chunks = [];
            for (let i = 0; i < missingIds.length; i += 100) chunks.push(missingIds.slice(i, i + 100));

            for (const chunk of chunks) {
                const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${chunk.join(',')}&size=420x420&format=Png&isCircular=false`;
                const resp = await axios.get(url);
                if (resp.data && resp.data.data) {
                    resp.data.data.forEach(item => {
                        if (item.state === 'Completed' && item.imageUrl) imageCache[item.targetId] = item.imageUrl;
                    });
                }
            }

            const updatedBans = currentBans.map(b => ({ ...b, Avatar: imageCache[b.UserId] || b.Avatar }));
            saveBansToFile(updatedBans);

        } catch (e) { console.error("Avatar fetch warning:", e.message); }
    }

    const result = {};
    userIds.forEach(id => result[id] = imageCache[id] || DEFAULT_GREY_IMG);
    res.json(result);
});

// --- AUTHENTICATION ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const account = authenticate(username, password);
    if (account) {
        res.json({ success: true, role: account.role, user: account.user, users: (account.role === 'owner' || account.role === 'developer') ? getUsers() : null });
    } else {
        res.status(401).json({ success: false });
    }
});

app.post('/api/register', (req, res) => {
    const { username, password, code } = req.body;
    const users = getUsers();
    const role = SIGNUP_CODES[code];
    if (!role) return res.status(403).json({ success: false, message: "Invalid Code" });
    if (users.find(u => u.user === username)) return res.status(400).json({ success: false, message: "User exists" });
    users.push({ user: username, pass: password, role });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true, role });
});

app.post('/api/admin/users/update', (req, res) => {
    const { username, password, targetUser, newRole } = req.body;
    const account = authenticate(username, password);
    if (!account || !['owner', 'developer'].includes(account.role)) return res.status(403).json({ success: false });
    const users = getUsers();
    const idx = users.findIndex(u => u.user === targetUser);
    if (idx > -1) { 
        users[idx].role = newRole; 
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); 
    }
    res.json({ success: true });
});

app.post('/api/admin/users/delete', (req, res) => {
    const { username, password, targetUser } = req.body;
    const account = authenticate(username, password);
    if (!account || !['owner', 'developer'].includes(account.role)) return res.status(403).json({ success: false });
    let users = getUsers();
    users = users.filter(u => u.user !== targetUser);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
});

// ==========================================
// 6. PAGE ROUTES
// ==========================================
app.get('/', (req, res) => {
    const htmlPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(htmlPath)) res.sendFile(htmlPath);
    else res.send("✅ System Online! (Upload index.html to /public to see site)");
});

app.get('/admin', (req, res) => {
    const adminPath = path.join(PUBLIC_DIR, 'admin.html');
    if (fs.existsSync(adminPath)) res.sendFile(adminPath);
    else res.status(404).send("admin.html not found");
});

app.get('/login', (req, res) => {
    const loginPath = path.join(PUBLIC_DIR, 'login.html');
    if (fs.existsSync(loginPath)) res.sendFile(loginPath);
    else res.status(404).send("login.html not found");
});

// ==========================================
// 7. START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`\nServer Online on Port ${PORT}`);
    console.log(`👉 Main Site:  http://localhost:${PORT}`);
    console.log(`👉 Mailbox:    http://localhost:${PORT}/pickup`);
});
