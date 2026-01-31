// =========================================
// script.js - PUBLIC SITE LOGIC
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    window.siteContent = {}; // Global store
    loadContent();
    loadStats();
    setupMarketplaceListeners();
});

// ==========================================
// 1. DYNAMIC CONTENT LOADER
// ==========================================
async function loadContent() {
    try {
        const response = await fetch('/api/content');
        if (!response.ok) throw new Error("Content API failed");

        const data = await response.json();
        window.siteContent = data; 

        // --- HERO SECTION ---
        if (data.hero) {
            const titleEl = document.getElementById('dynamic-title');
            const subEl = document.getElementById('dynamic-subtitle');
            if (titleEl) titleEl.innerHTML = data.hero.title || "Tennessee State Roleplay";
            if (subEl) subEl.innerText = data.hero.subtitle || "Experience the highest quality roleplay.";

            const statusTextEl = document.getElementById('server-status-text');
            const statusPill = document.getElementsByClassName('status-pill')[0];
            const pulsingDot = document.getElementsByClassName('pulsing-dot')[0];

            if (data?.hero?.statusColor && statusPill) {
             statusPill.style.color = data.hero.statusColor;

                if (data?.hero?.statusColor && pulsingDot) {
                    pulsingDot.style.background = data.hero.statusColor;
                }
            }

            

            if (data.hero.statusText && statusTextEl) statusTextEl.innerText = data.hero.statusText;

            const bgDiv = document.getElementById('dynamic-hero-bg');
            const images = data.hero.images || (data.hero.bgImage ? [data.hero.bgImage] : []);

            if (bgDiv && images.length > 0) {
                bgDiv.style.backgroundImage = `url('${images[0]}')`;
                if (images.length > 1) startHeroSlideshow(bgDiv, images);
            }
        }

        // --- MARKETPLACE COLORS ---
        if (data.perks) {
            Object.keys(data.perks).forEach(key => {
                applyCardStyles(key, data.perks[key]);
            });
        }

        // --- FEATURES SECTION ---
        renderFeatures(data);

        // --- GALLERY SECTION ---
        renderGallery(data);

    } catch (error) {
        console.error("Error loading site content:", error);
    }
}

// Helper: Apply Colors to Cards
function applyCardStyles(type, perkData) {
    if (!perkData) return;
    const card = document.querySelector(`.perk-btn[data-type="${type}"]`);
    if (!card) return;

    const color = perkData.color || '#ffffff';
    card.style.border = `1px solid ${color}`; 
    card.style.boxShadow = `0 0 15px ${color}40`; 

    const icon = card.querySelector('i');
    if (icon) {
        icon.style.color = color;
        icon.style.textShadow = `0 0 10px ${color}60`;
    }

    const title = card.querySelector('h3');
    if (title) {
        title.style.color = color;
    }
}

// Helper: Slideshow Logic
function startHeroSlideshow(bgDiv, images) {
    let currentImgIndex = 0;
    if (window.bgInterval) clearInterval(window.bgInterval);

    window.bgInterval = setInterval(() => {
        currentImgIndex = (currentImgIndex + 1) % images.length;
        const nextImg = images[currentImgIndex];

        // Preload image to prevent flickering
        const imgLoader = new Image();
        imgLoader.src = nextImg;

        imgLoader.onload = () => {
            bgDiv.classList.add('fading-out');
            setTimeout(() => {
                bgDiv.style.backgroundImage = `url('${nextImg}')`;
                bgDiv.classList.remove('fading-out');
            }, 5000);
        };
    }, 5000);
}

// Helper: Render Features
function renderFeatures(data) {
    const activityContainer = document.getElementById('activity-container');
    const featuresList = data.activities || data.features || [];

    if (activityContainer && Array.isArray(featuresList)) {
        activityContainer.innerHTML = ''; 
        if (featuresList.length === 0) activityContainer.innerHTML = '<p style="color:#666; text-align:center; width:100%;">No features currently listed.</p>';

        featuresList.forEach((act, index) => {
            const card = document.createElement('div');
            // Make the first card span 2 columns if we have at least 3 items (classic bento look)
            let sizeClass = (index === 0 && featuresList.length >= 3) ? 'span-2' : '';
            card.className = `bento-card ${sizeClass}`;

            card.innerHTML = `
                <div style="display: flex; flex-direction: column; height: 100%; justify-content: center;">
                    <i class="${act.icon || 'fas fa-star'}" style="color: #FF3B30; font-size: 1.5rem; margin-bottom: 15px;"></i>
                    <h3 style="margin-bottom: 10px; color: #fff;">${escapeHtml(act.title || 'Untitled')}</h3>
                    <p style="color: #aaa; font-size: 0.9rem; line-height: 1.4;">${escapeHtml(act.desc || 'No description provided.')}</p>
                </div>
            `;
            activityContainer.appendChild(card);
        });
    }
}

// Helper: Render Gallery
function renderGallery(data) {
    const galleryContainer = document.getElementById('dynamic-gallery');

    if (galleryContainer && data.gallery && Array.isArray(data.gallery)) {
        galleryContainer.innerHTML = '';

        data.gallery.forEach((item, index) => {
            let imgUrl = item;
            let creditText = 'Community Member'; 

            // Handle object structure { url: "...", credit: "..." }
            if (typeof item === 'object') {
                imgUrl = item.url;
                if (item.credit) creditText = item.credit;
            }

            if (!imgUrl) return;

            const imgCard = document.createElement('div');
            // Create visual interest: First and fourth items span 2 rows if enough items exist
            const sizeClass = (data.gallery.length >= 4 && (index === 0 || index === 3)) ? 'span-2 row-2' : '';

            imgCard.className = `bento-card ${sizeClass} gallery-card`; 
            imgCard.style.padding = '0'; 
            imgCard.style.overflow = 'hidden';

            imgCard.innerHTML = `
                <img src="${imgUrl}" alt="Gallery" loading="lazy" style="width:100%; height:100%; object-fit:cover; display:block; transition: transform 0.3s ease;">
                <div class="photo-credit">
                    <i class="fas fa-camera"></i> ${escapeHtml(creditText)}
                </div>
            `;
            galleryContainer.appendChild(imgCard);
        });
    }
}

function escapeHtml(text) {
    if (!text) return text;
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ==========================================
// 2. MARKETPLACE MODAL LOGIC
// ==========================================
function setupMarketplaceListeners() {
    const modal = document.getElementById('perks-modal');
    const closeBtn = document.querySelector('.close-modal');
    const modalBody = document.getElementById('modal-body');

    document.querySelectorAll('.perk-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-type');
            if (!type) return;

            const allPerks = window.siteContent.perks || {}; 

            // Fallback data if JSON is missing specific perk
            const item = allPerks[type] || { 
                title: type.toUpperCase(), 
                price: "Contact Staff", 
                link: "#", 
                color: "#ffffff", 
                perks: ["Details coming soon..."] 
            };

            const accentColor = item.color || "#ffffff";
            const perksListHtml = `<ul style="text-align:left; margin: 20px 0; color:#ccc; list-style:none; padding-left:10px;">
                ${(item.perks || []).map(p => `<li style="margin-bottom:8px;"><i class="fas fa-check" style="color:${accentColor}; margin-right:8px;"></i>${escapeHtml(p)}</li>`).join('')}
            </ul>`;

            if (modalBody) {
                modalBody.innerHTML = `
                    <h2 style="margin-bottom:5px; border-bottom:1px solid #333; padding-bottom:10px; color:${accentColor};">${item.title}</h2>
                    <h3 style="color: white; margin-bottom: 15px;">${item.price}</h3>
                    ${perksListHtml}
                    <a href="${item.link}" target="_blank" class="btn-modern" style="width:100%; text-align:center; display:block; margin-top:15px; text-decoration: none; background-color:${accentColor}; color: #000; font-weight: bold; border:none; box-shadow: 0 0 15px ${accentColor}60;">
                        ${item.link === '#' ? 'Unavailable' : 'View / Purchase'}
                    </a>
                `;
            }

            if(modal) modal.style.display = 'flex';
        });
    });

    if (closeBtn) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });

    // Close on click outside
    window.addEventListener('click', (e) => { 
        if (e.target == modal) modal.style.display = 'none'; 
    });
}

// ==========================================
// 3. LIVE SERVER STATS
// ==========================================
async function loadStats() {
    try {
        // NOTE: Ensure your index.js has an endpoint for this. 
        // If using the consolidated Admin stats, point this to /api/admin/stats (but that requires auth).
        // It is recommended to add a public endpoint /api/erlc-stats back to your index.js if it is missing.
        const response = await fetch('/api/erlc-stats');

        if (!response.ok) throw new Error("Stats API offline");

        const players = await response.json();
        let counts = { total: 0, police: 0, civ: 0, dot: 0, fire: 0 };

        if (Array.isArray(players)) {
            counts.total = players.length;
            players.forEach(p => {
                const team = (p.Team || "").toLowerCase();
                if (team.includes('police') || team.includes('sheriff')) counts.police++;
                else if (team.includes('civilian')) counts.civ++;
                else if (team.includes('transportation') || team.includes('dot')) counts.dot++;
                else if (team.includes('fire') || team.includes('medic')) counts.fire++;
            });
        }

        updateStat("player-count", counts.total);
        updateStat("police-count", counts.police);
        updateStat("civ-count", counts.civ);
        updateStat("dot-count", counts.dot);
        updateStat("fire-count", counts.fire);

    } catch (error) {
        // Fallback to 0 if API fails or server is offline
        updateStat('player-count', 0);
        updateStat('police-count', 0);
        updateStat('civ-count', 0);
        updateStat('dot-count', 0);
        updateStat('fire-count', 0);
    }
}

function updateStat(id, val) {
    const el = document.getElementById(id);
    if(el) {
        // Simple animation logic
        const current = parseInt(el.innerText) || 0;
        if (current !== val) {
            el.style.opacity = 0;
            setTimeout(() => {
                el.innerText = val;
                el.style.opacity = 1;
            }, 200);
        }
    }
}

// Auto-refresh stats every 30 seconds
setInterval(loadStats, 30000);
