const toastStyles = `
    #toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
    }
    .custom-toast {
        background: rgba(20, 20, 20, 0.95);
        color: #fff;
        padding: 12px 20px;
        border-radius: 8px;
        border-left: 4px solid #30d158; /* Default Green */
        box-shadow: 0 5px 15px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 250px;
        backdrop-filter: blur(10px);
        animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        pointer-events: auto;
    }
    .custom-toast.error { border-left-color: #ff453a; }
    .custom-toast.warning { border-left-color: #ff9f0a; }

    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        to { transform: translateX(10px); opacity: 0; }
    }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = toastStyles;
document.head.appendChild(styleSheet);

let toastContainer = document.getElementById('toast-container');
if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
}

window.notify = function(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;

    let icon = '<i class="fas fa-check-circle" style="color:#30d158"></i>';
    if(type === 'error') icon = '<i class="fas fa-times-circle" style="color:#ff453a"></i>';
    if(type === 'warning') icon = '<i class="fas fa-exclamation-triangle" style="color:#ff9f0a"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    document.getElementById('toast-container').appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "fadeOut 0.4s forwards";
        setTimeout(() => toast.remove(), 400);
    }, 3500);
};

const API = { 
    STATS: '/api/admin/stats', 
    CONTENT: '/api/content', 
    BANS: '/api/bans',
    FETCH_AVATARS: '/api/fetch-avatars',
    SERVER_ACTION: '/api/admin/action',
    COMMAND_USER: '/api/command-user'
};

const PERMITTED_ROLES = ['owner', 'developer', 'dev', 'manager', 'co-owner', 'superadmin'];

let currentUserRole = '';
let banState = { all: [], filtered: [], page: 1, perPage: 10 };

// Uptime variables
let serverBootTime = null; 
let uptimeTicker = null;
let lastPlayersHash = "";

let siteConfig = { 
    hero: {}, 
    features: [], 
    gallery: [], 
    perks: {
        'tn-plus': { color: '#ff3b30' },
        'vip': { color: '#ffcc00' },
        'booster': { color: '#30d158' },
        'ads': { color: '#0a84ff' },
        'donate': { color: '#bf5af2' }
    } 
};
// ==========================================
//        GLOBAL CONFIG & VARIABLES
// ==========================================
const DASHBOARD_URL = "https://tennessebot.onrender.com/pickup";
window.savedMailboxUrl = DASHBOARD_URL; // Sync these so older logic works too
window.savedAccessKey = "";

// ==========================================
//           HELPER FUNCTIONS
// ==========================================

// Format milliseconds into 00:00:00
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)));

    return [hours, minutes, seconds]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
}

// ==========================================
//           BAN FILTER LOGIC
// ==========================================
window.filterBanSearch = function(query) {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
        banState.filtered = banState.all;
    } else {
        banState.filtered = banState.all.filter(ban => {
            const uName = (ban.User || '').toLowerCase();
            const uId = (ban.UserId || '').toString();
            const uReason = (ban.Reason || '').toLowerCase();
            const uMod = (ban.Moderator || '').toLowerCase();

            return uName.includes(lowerQuery) || 
                   uId.includes(lowerQuery) || 
                   uReason.includes(lowerQuery) || 
                   uMod.includes(lowerQuery);
        });
    }
    banState.page = 1;
    renderBanTable();
};

// ==========================================
//           INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin Dashboard Loaded.");

    // Load stored credentials if they exist (optional, mostly for the key now)
    const storedUrl = localStorage.getItem('mailbox_url');
    const storedKey = localStorage.getItem('bot_key');

    if (storedKey) {
        window.savedAccessKey = storedKey;
        const keyInput = document.getElementById('bot-access-key');
        if (keyInput) keyInput.value = storedKey;
    }

    // Force the hardcoded URL into the input box for clarity
    const urlInput = document.getElementById('bot-host-url');
    if (urlInput) urlInput.value = DASHBOARD_URL;
    
    if (typeof window.showConnectedUI === 'function') {
        window.showConnectedUI();
    }
});

// ==========================================
//      REAL-TIME STATUS UPDATE LOOP
// ==========================================
window.updateDashboardStats = async function() {
    const latencyVal = document.getElementById('stat-latency');
    const latencySub = latencyVal?.parentElement.querySelector('.stat-sub');
    const uptimeVal = document.getElementById('bot-uptime');

    try {
        // Fetch data (with timestamp to prevent caching)
        const response = await fetch(DASHBOARD_URL + "?t=" + Date.now());
        const data = await response.json();

        // 1. Update Latency / Ping
        if (data.status && typeof data.status.ping !== 'undefined') {
            const ping = data.status.ping;
            if (latencyVal) latencyVal.innerText = ping + " ms";

            if (latencySub) {
                if (ping < 100) {
                    latencySub.innerText = "Excellent";
                    latencySub.style.color = "#32d74b"; // Green
                } else if (ping < 250) {
                    latencySub.innerText = "Stable";
                    latencySub.style.color = "#ff9f0a"; // Orange
                } else {
                    latencySub.innerText = "High Latency";
                    latencySub.style.color = "#ff453a"; // Red
                }
            }
        } else {
            if (latencyVal) latencyVal.innerText = "-- ms";
        }

        // 2. Update Uptime
        if (data.status && data.status.startedAt) {
            const diff = Date.now() - data.status.startedAt;
            if (uptimeVal) {
                uptimeVal.innerText = formatDuration(diff);
                uptimeVal.style.color = "#fff"; 
            }
        } else {
            if (uptimeVal) uptimeVal.innerText = "Offline";
            if (uptimeVal) uptimeVal.style.color = "#ff453a";
        }

    } catch (err) {
        // Handle Errors (Offline)
        if (latencyVal) latencyVal.innerText = "ERR";
        if (latencySub) {
            latencySub.innerText = "Offline";
            latencySub.style.color = "#ff453a";
        }
        if (uptimeVal) {
            uptimeVal.innerText = "Offline";
            uptimeVal.style.color = "#ff453a";
        }
    }
};

// Start the loop immediately
window.updateDashboardStats();
setInterval(window.updateDashboardStats, 1000);

window.showConnectedUI = function() {
    document.getElementById('bot-login-gate').classList.add('hidden');
    document.getElementById('bot-dashboard-content').classList.remove('hidden');
    document.getElementById('btn-disconnect').classList.remove('hidden');

    const statusSpan = document.getElementById('connection-status');
    if (statusSpan) {
        statusSpan.innerText = "Connected via Relay";
        statusSpan.style.color = "#30d158";
    }
};

window.attemptBotLogin = async function() {
    const urlInput = document.getElementById('bot-host-url').value.trim();
    const keyInput = document.getElementById('bot-access-key').value.trim();
    const btnText = document.querySelector('#bot-login-gate .save-btn');

    if (!urlInput || !keyInput) {
        window.notify("Please fill in both fields.", "warning"); 
        return;
    }

    if (btnText) btnText.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Checking...';

    try {
        const res = await fetch(urlInput); 
        if (res.ok) {
            window.savedMailboxUrl = urlInput;
            window.savedAccessKey = keyInput;
            localStorage.setItem('mailbox_url', urlInput);
            localStorage.setItem('bot_key', keyInput);

            window.showConnectedUI();
            window.notify("Connected to Bot Relay", "success"); 
            if (btnText) btnText.innerHTML = '<i class="fas fa-plug"></i> Establish Connection';
        } else {
            throw new Error("URL Unreachable");
        }
    } catch (e) {
        console.error(e);
        window.notify("Could not reach that URL.", "error"); 
        if (btnText) btnText.innerHTML = '<i class="fas fa-plug"></i> Establish Connection';
    }
};

window.disconnectBot = function() {
    localStorage.removeItem('mailbox_url');
    localStorage.removeItem('bot_key');
    location.reload();
};

window.sendCommand = async function(type, command, targetId = null) {
    if (!window.savedMailboxUrl) {
        window.notify("Not connected! Please log in first.", "error"); 
        return;
    }

    const payload = {
        key: window.savedAccessKey,
        type: type,
        command: command,
        targetId: targetId,
        timestamp: Date.now()
    };

    try {
        await fetch(window.savedMailboxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        window.notify(`Command '${command}' sent successfully!`, "success"); 
    } catch (err) {
        console.error(err);
        window.notify("Failed to send command.", "error"); 
    }
};

window.sendModeration = async function(action) {
    const targetId = document.getElementById('mod-target-id').value.trim();
    if (!targetId) return window.notify("Please enter a User ID first.", "warning");

    if (!confirm(`Are you sure you want to ${action.toUpperCase()} this user?`)) return;

    const payload = {
        key: window.savedAccessKey,
        type: 'moderation', 
        command: action,    
        targetId: targetId, 
        timestamp: Date.now()
    };

    try {
        await fetch(window.savedMailboxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        window.notify(`Sent ${action} command for ID: ${targetId}`, "success");
    } catch (e) {
        window.notify("Failed to send command.", "error");
    }
};

window.updateBotStatus = async function() {
    const type = document.getElementById('status-type').value;
    const text = document.getElementById('status-text').value;

    if (!text) return window.notify("Please enter status text.", "warning");

    const payload = {
        key: window.savedAccessKey,
        type: 'system',        
        command: 'setstatus', 
        args: { type, text }, 
        timestamp: Date.now()
    };

    try {
        await fetch(window.savedMailboxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        window.notify("Status update sent!", "success");
    } catch (e) {
        window.notify("Failed to send status command.", "error");
    }
};

window.triggerCommand = async function(commandType) {
    if (!window.savedMailboxUrl) return window.notify("Bot not connected!", "error");

    const feedback = document.getElementById('cmd-feedback');
    const reasonInput = document.getElementById('cmd-reason');
    const message = reasonInput ? reasonInput.value.trim() : "";

    if(feedback) {
        feedback.innerText = `Sending :${commandType}...`;
        feedback.style.color = "#ffff00";
    }

    const payload = {
        key: window.savedAccessKey,
        type: 'session',            
        command: commandType,       
        args: { message: message }, 
        admin: sessionStorage.getItem('tsrp_user') || 'WebConsole',
        timestamp: Date.now()
    };

    try {
        await fetch(window.savedMailboxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        window.notify(`Session Command :${commandType} Sent!`, "success");

        if (reasonInput) reasonInput.value = ''; 
        if (feedback) {
            feedback.innerText = `Sent :${commandType}`;
            feedback.style.color = "#30d158";
        }

    } catch (err) {
        console.error(err);
        window.notify("Failed to reach Bot Relay", "error");
        if (feedback) {
            feedback.innerText = "Connection Failed";
            feedback.style.color = "#ff3b30";
        }
    }
    setTimeout(() => { if(feedback) feedback.innerText = ""; }, 3000);
};

document.addEventListener('DOMContentLoaded', () => {
    const user = sessionStorage.getItem('tsrp_user');
    const rawRole = sessionStorage.getItem('tsrp_role') || 'staff';
    currentUserRole = rawRole.toLowerCase();

    if (!user) return window.location.href = 'login.html';

    const userDisplay = document.getElementById('user-display');
    const roleDisplay = document.getElementById('user-role-display');
    const avatarDisplay = document.getElementById('user-avatar');

    if(userDisplay) userDisplay.textContent = user;
    if(roleDisplay) roleDisplay.textContent = rawRole; 
    if(avatarDisplay) avatarDisplay.textContent = user.charAt(0).toUpperCase();

    if (PERMITTED_ROLES.includes(currentUserRole)) {
        const serverTab = document.getElementById('nav-item-server');
        const editorTab = document.getElementById('nav-item-editor');
        if(serverTab) serverTab.style.display = 'block';
        if(editorTab) editorTab.style.display = 'block';
    }

    loadStats(); 
    setInterval(loadStats, 5000); 
    startSmoothTicker();

    handleRouting(); 
});

window.addEventListener('popstate', handleRouting);

function logout() { 
    sessionStorage.clear(); 
    window.location.href = 'login.html'; 
}

async function fetchAuth(url, method = 'GET', body = null) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'username': sessionStorage.getItem('tsrp_user'), 
            'password': sessionStorage.getItem('tsrp_pass') 
        };
        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        if (!res.ok) return null; 
        return await res.json();
    } catch (err) { console.error(err); return null; }
}

function handleRouting() {
    const hash = window.location.hash.substring(1); 

    if (!hash) {
        switchTab('dashboard', null, false);
        return;
    }

    if (hash.startsWith('editor-')) {
        const subTab = hash.replace('editor-', '');
        switchTab('editor', null, false);
        setTimeout(() => switchEditTab(subTab, null, false), 10);
    } 
    else {
        switchTab(hash, null, false);
    }
}

function switchTab(tabId, navElement, updateHistory = true) {
    if ((tabId === 'editor' || tabId === 'server') && !PERMITTED_ROLES.includes(currentUserRole)) {
        console.log("Access Denied to " + tabId);
        window.notify("You do not have permission to access this area.", "error"); 
        return; 
    }

    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));

    const target = document.getElementById(`view-${tabId}`);
    if (target) target.classList.remove('hidden');

    const navBtn = navElement || document.getElementById(`nav-item-${tabId}`);
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (navBtn) navBtn.classList.add('active');

    if (updateHistory) {
        history.pushState(null, "", `#${tabId}`);
    }

    if (tabId === 'bans') loadBans();
    if (tabId === 'editor') loadSiteData();
}

function switchEditTab(tabName, btn, updateHistory = true) {
    document.querySelectorAll('.edit-tab-content').forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
    });
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));

    const targetPane = document.getElementById(`edit-tab-${tabName}`);
    if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'block';
    }

    const targetBtn = btn || document.querySelector(`.pill-btn[onclick*="'${tabName}'"]`);
    if (targetBtn) targetBtn.classList.add('active');

    if (updateHistory) {
        history.pushState(null, "", `#editor-${tabName}`);
    }
}

function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(text) {
    if (text == null) return '';
    return String(text).replace(/"/g, "&quot;");
}

function getAvatarHTML(name, url) {
    const safeName = escapeHtml(name || '?');
    const initial = (name || '?').charAt(0).toUpperCase();

    const style = "width: 40px; height: 40px; object-fit: cover; border-radius: 50%; display: block;";
    const fallbackStyle = "width: 40px; height: 40px; background: #333; color: white; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; font-size: 16px;";
    const fallbackHTML = `<div style="${fallbackStyle}">${initial}</div>`;

    if (url && url.length > 5 && !url.includes('null') && !url.includes('undefined')) {
        const escapedFallback = fallbackHTML.replace(/"/g, "&quot;").replace(/'/g, "\\'");
        return `<img src="${url}" style="${style}" alt="${safeName}" onerror="this.outerHTML='${escapedFallback}'">`;
    }
    return fallbackHTML;
}

function parseTime(timeStr) {
    if(!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    let seconds = 0;
    if(parts.length === 3) seconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    else if (parts.length === 4) seconds = (parts[0] * 86400) + (parts[1] * 3600) + (parts[2] * 60) + parts[3];
    return seconds;
}

function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function startSmoothTicker() {
    if(uptimeTicker) clearInterval(uptimeTicker);
    uptimeTicker = setInterval(() => {
        const el = document.getElementById('stat-uptime');
        const status = document.getElementById('stat-status')?.textContent;

        if(el && serverBootTime && status !== "Offline") {
            const now = new Date();
            // Continuously update based on local time difference from the anchored boot time
            const diffSeconds = Math.floor((now - serverBootTime) / 1000);
            el.textContent = formatTime(Math.max(0, diffSeconds));
        } else if (el && status === "Offline") {
            el.textContent = "00:00:00";
        }
    }, 1000);
}

async function loadStats() {
    if(document.getElementById('view-dashboard')?.classList.contains('hidden')) return;
    
    const data = await fetchAuth(API.STATS);
    if (!data) return;

    const safeText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };

    // 1. Get the uptime string (e.g., "00:05:20") and convert to total seconds
    const serverUptimeStr = data.system?.uptime || "00:00:00";
    const serverSecondsFromAPI = parseTime(serverUptimeStr);

    // 2. Logic to prevent ticker resetting on every fetch
    if (!serverBootTime) {
        // Initial set anchor
        serverBootTime = new Date(Date.now() - (serverSecondsFromAPI * 1000));
    } else {
        // Check if server *actually* restarted.
        // We only reset if the API reports an uptime that is significantly lower (e.g., >30s difference)
        // than what we expect based on our local timer.
        // This ignores small lags or API caching issues.
        const expectedSeconds = (Date.now() - serverBootTime.getTime()) / 1000;
        
        if (serverSecondsFromAPI < (expectedSeconds - 30)) {
            console.log("Server restart detected. Resetting ticker.");
            serverBootTime = new Date(Date.now() - (serverSecondsFromAPI * 1000));
        }
    }

    safeText('stat-memory', data.system?.memory || "0 MB");
    safeText('stat-status', data.game?.status || "Offline");
    safeText('stat-players', (data.game?.players || []).length);
    renderPlayers(data.game?.players || []);
}

function renderPlayers(players) {
    const tbody = document.querySelector('#players-table tbody');
    if(!tbody) return;

    const currentHash = JSON.stringify(players);
    if (currentHash === lastPlayersHash) return;
    lastPlayersHash = currentHash;

    if(players.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No players online.</td></tr>';
        return;
    }
    let html = '';
    players.forEach(p => {
        let teamClass = 'team-civ';
        const t = (p.Team || '').toLowerCase();
        if(t.includes('police')) teamClass = 'team-police';
        else if(t.includes('sheriff')) teamClass = 'team-sheriff';
        else if(t.includes('fire') || t.includes('ems')) teamClass = 'team-fire';

        html += `<tr>
            <td class="${teamClass}">${escapeHtml(p.Player)}</td>
            <td>${escapeHtml(p.Callsign || '-')}</td>
            <td>${escapeHtml(p.Team)}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

async function loadBans() {
    const tbody = document.querySelector('#bans-table tbody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Fetching records...</td></tr>';
    const data = await fetchAuth(API.BANS);
    if (!data) {
        tbody.innerHTML = '<tr><td colspan="4">Error loading bans.</td></tr>';
        window.notify("Failed to load ban list", "error"); 
        return;
    }

    banState.all = Array.isArray(data) ? data : (data.bans || []);
    banState.filtered = banState.all;
    banState.page = 1; 
    renderBanTable();
}

function changeBanPage(direction) {
    const totalPages = Math.ceil(banState.filtered.length / banState.perPage);
    const newPage = banState.page + direction;
    if (newPage > 0 && newPage <= totalPages) {
        banState.page = newPage;
        renderBanTable();
    }
}

function renderBanTable() {
    const tbody = document.querySelector('#bans-table tbody');
    if (!tbody) return;

    const start = (banState.page - 1) * banState.perPage;
    const pageData = banState.filtered.slice(start, start + banState.perPage);
    const totalPages = Math.ceil(banState.filtered.length / banState.perPage) || 1;

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #888;">No bans found.</td></tr>';
        const pageInfo = document.getElementById('ban-page-info');
        if(pageInfo) pageInfo.textContent = `Page ${banState.page} of ${totalPages}`;
        return;
    }

    const tableRows = pageData.map(ban => {
        const avatarUrl = ban.Avatar || ban.avatar || ban.Image || ban.image || '';
        const uName = escapeHtml(ban.User);
        const uId = escapeHtml(ban.UserId);
        const uReason = escapeHtml(ban.Reason);
        const uMod = escapeHtml(ban.Moderator);
        const uDate = escapeHtml(ban.Date);

        return `
            <tr>
                <td>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        ${getAvatarHTML(ban.User, avatarUrl)}
                        <div>
                            <span style="display:block; font-weight:600; color:white;">${uName}</span>
                            <small style="color:#888; font-family:monospace;">ID: ${uId}</small>
                        </div>
                    </div>
                </td>
                <td>${uDate}</td>
                <td title="${uReason}" style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${uReason}</td>
                <td>${uMod}</td>
            </tr>`;
    }).join('');

    tbody.innerHTML = tableRows;
    const pageInfo = document.getElementById('ban-page-info');
    if(pageInfo) pageInfo.textContent = `Page ${banState.page} of ${totalPages}`;
}

function addGalleryRow(url = '', credit = '') {
    const container = document.getElementById('gallery-rows-container');
    if(!container) return;

    const div = document.createElement('div');
    div.className = 'gallery-row-item';
    div.style.cssText = "display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin-bottom: 8px;";

    div.innerHTML = `
        <div style="flex: 2;">
            <input type="text" class="modern-input gallery-url" value="${escapeAttribute(url)}" placeholder="Image Link (https://...)" style="width: 100%; color:white; background:#111; border:1px solid #333; padding:8px; border-radius:4px;">
        </div>
        <div style="flex: 1;">
            <input type="text" class="modern-input gallery-credit" value="${escapeAttribute(credit)}" placeholder="Credit Name" style="width: 100%; color:white; background:#111; border:1px solid #333; padding:8px; border-radius:4px;">
        </div>
        <button type="button" onclick="this.parentElement.remove()" style="background: #ff3b30; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">
            <i class="fas fa-trash"></i>
        </button>
    `;
    container.appendChild(div);
}

const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };

async function loadSiteData() {
    if(siteConfig.hero && siteConfig.hero.title) return; 

    console.log("Fetching site config...");
    const data = await fetchAuth(API.CONTENT);

    if (data) {
        siteConfig = { ...data, features: data.features || data.activities || [] };

        setVal('hero-title', data.hero?.title);
        setVal('hero-sub', data.hero?.subtitle);
        setVal('btn-primary-text', data.hero?.btnText);
        setVal('btn-primary-url', data.hero?.btnUrl);
        setVal('hero-status-text', data.hero?.statusText);
        setVal('hero-status-color', data.hero?.statusColor);

        const bgField = document.getElementById('hero-images');
        if(bgField) {
            let bgVal = data.hero?.bgImage || "";
            if (!bgVal && Array.isArray(data.hero?.images)) bgVal = data.hero.images.join('\n');
            bgField.value = bgVal;
        }

        renderFeatureSlots();

        const galleryContainer = document.getElementById('gallery-rows-container');
        if(galleryContainer) {
            galleryContainer.innerHTML = ''; 
            const galleryData = data.gallery || [];
            if (galleryData.length === 0) addGalleryRow(); 
            else {
                galleryData.forEach(item => {
                    if (typeof item === 'object') addGalleryRow(item.url, item.credit);
                    else addGalleryRow(item, '');
                });
            }
        }

        const perkIds = ['tn-plus', 'vip', 'booster', 'ads', 'donate'];
        perkIds.forEach(id => {
            if(data.perks && data.perks[id]) {
                setVal(`${id}-price`, data.perks[id].price);
                setVal(`${id}-link`, data.perks[id].link);
                setVal(`${id}-color`, data.perks[id].color || "#ffffff"); 
                const listData = data.perks[id].perks;
                setVal(`${id}-list`, Array.isArray(listData) ? listData.join('\n') : (listData || ""));
            }
        });
        updatePreview();
    }
}

function updatePreview() {
    const textInput = document.getElementById('hero-status-text');
    const colorInput = document.getElementById('hero-status-color');
    const previewDot = document.getElementById('preview-dot');
    const previewText = document.getElementById('preview-text');

    if(previewDot && colorInput) {
        previewDot.style.background = colorInput.value;
        previewDot.style.boxShadow = `0 0 10px ${colorInput.value}`;
    }
    if(previewText && textInput) {
        previewText.innerText = textInput.value || "Status Preview";
    }
}

function renderFeatureSlots() {
    const container = document.getElementById('features-list-container');
    if (!container) return;
    container.innerHTML = '';
    if (!siteConfig.features || siteConfig.features.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#666;">No cards added.</p>';
    }
    siteConfig.features.forEach((feat, index) => {
        container.innerHTML += `
            <div class="feature-item" style="position:relative; background: rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:10px;">
                <button class="btn-trash" onclick="removeFeatureSlot(${index})" style="position:absolute; top:10px; right:10px; background:transparent; border:none; color:#ff3b30; cursor:pointer;"><i class="fas fa-times"></i></button>
                <div style="margin-bottom:10px;">
                    <label style="font-size:12px; color:#888;">Title</label>
                    <input type="text" class="modern-input" value="${escapeAttribute(feat.title || '')}" oninput="updateFeatureData(${index}, 'title', this.value)" style="width:100%; padding:8px; background:#111; border:1px solid #333; color:white; border-radius:4px;">
                </div>
                <div>
                    <label style="font-size:12px; color:#888;">Description</label>
                    <textarea class="modern-input" rows="2" oninput="updateFeatureData(${index}, 'desc', this.value)" style="width:100%; padding:8px; background:#111; border:1px solid #333; color:white; border-radius:4px;">${escapeHtml(feat.desc || '')}</textarea>
                </div>
            </div>`;
    });
}

function updateFeatureData(index, key, value) {
    if(siteConfig.features[index]) siteConfig.features[index][key] = value;
}

function addFeatureSlot() {
    if(!siteConfig.features) siteConfig.features = [];
    siteConfig.features.push({ icon: 'fas fa-star', title: 'New Feature', desc: 'Description...' });
    renderFeatureSlots();
}

function removeFeatureSlot(index) {
    if(confirm("Delete this card?")) {
        siteConfig.features.splice(index, 1);
        renderFeatureSlots();
    }
}

async function saveSiteData() {
    const saveBtn = document.querySelector('.save-btn');
    const originalHTML = saveBtn.innerHTML;

    const bgInput = getVal('hero-images');
    const bgList = bgInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const finalImages = bgList.length > 0 ? bgList : ["https://tr.rbxcdn.com/53eb9b17fe1432a809c73a13889b5006/150/150/Image/Png"];

    const galleryRows = document.querySelectorAll('.gallery-row-item');
    const galleryFormatted = Array.from(galleryRows).map(row => {
        const url = row.querySelector('.gallery-url').value.trim();
        const credit = row.querySelector('.gallery-credit').value.trim();
        return url.length > 0 ? { url, credit } : null;
    }).filter(item => item !== null);

    const getPerkData = (id, defaultTitle) => {
        return {
            title: defaultTitle,
            price: getVal(`${id}-price`),
            link: getVal(`${id}-link`) || "#",
            color: getVal(`${id}-color`) || "#ffffff",
            perks: getVal(`${id}-list`).split('\n').map(p => p.trim()).filter(p => p.length > 0)
        };
    };

    const updatedData = {
        hero: {
            title: getVal('hero-title'),
            subtitle: getVal('hero-sub'),
            btnText: getVal('btn-primary-text'),
            btnUrl: getVal('btn-primary-url'),
            statusText: getVal('hero-status-text'),
            statusColor: getVal('hero-status-color'),
            images: finalImages, 
            bgImage: finalImages[0] || "" 
        },
        features: siteConfig.features || [],
        activities: siteConfig.features || [],
        gallery: galleryFormatted,
        perks: {
            'tn-plus': getPerkData('tn-plus', 'Tennessee +'),
            'vip': getPerkData('vip', 'V.I.P'),
            'booster': getPerkData('booster', 'Server Booster'),
            'ads': getPerkData('ads', 'Sponsorship'),
            'donate': getPerkData('donate', 'Donate')
        }
    };

    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    const result = await fetchAuth(API.CONTENT, 'POST', updatedData);

    if (result && result.success) {
        siteConfig = updatedData;
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        saveBtn.style.background = '#30d158';
        window.notify("Site content updated successfully!", "success"); 
        setTimeout(() => { saveBtn.innerHTML = originalHTML; saveBtn.style.background = ''; }, 2000);
    } else {
        saveBtn.innerHTML = '<i class="fas fa-times"></i> Error';
        saveBtn.style.background = '#ff3b30';
        window.notify("Failed to save content. Check console.", "error"); 
        setTimeout(() => { saveBtn.innerHTML = originalHTML; saveBtn.style.background = ''; }, 2000);
    }
}
