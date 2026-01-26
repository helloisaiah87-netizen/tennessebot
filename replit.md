# Tennessee State Roleplay Dashboard

## Overview

This is a web-based admin dashboard for a Roblox Emergency Response: Liberty County (ERLC) roleplay community called "Tennessee State Roleplay" (TSRP). The application provides a public-facing landing page for community members and a staff portal for managing bans, users, and server content.

The system integrates with the ERLC API to fetch game server data and manage player bans. It uses a file-based JSON storage system for persistence and serves a modern, glass-morphism styled frontend.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Express.js (Node.js)
- **Entry Point**: `server.js` (referenced in package.json, main logic appears in `index.js`)
- **Routing**: Mix of inline routes in main file and modular routes in `/routes/auth.js`
- **Data Storage**: File-based JSON storage (no database)
  - `users.json` - Staff accounts with username, password, and role
  - `bans.json` - Player ban records
  - `content.json` - Dynamic website content (hero section, activities, gallery)

### Frontend Architecture
- **Static Files**: Served from `/public` directory
- **Pages**:
  - `index.html` - Public landing page with sidebar navigation
  - `login.html` - Staff authentication portal
  - `register.html` - Staff account creation (requires signup codes)
  - `admin.html` - Staff dashboard for ban management
- **Styling**: Custom CSS with CSS variables for theming, glass-morphism design
- **JavaScript**: Vanilla JS for API calls and DOM manipulation

### Authentication System
- Simple username/password authentication stored in plaintext JSON
- Role-based access control with levels: owner, co-owner, admin, developer, mod
- Signup codes required for registration that map to specific roles
- No session management (credentials stored client-side in sessionStorage)

### API Structure
- `/api/content` - Returns dynamic website content
- `/api/bans` - Ban management endpoints
- `/auth/login` - Staff authentication
- `/auth/register` - Staff registration

## External Dependencies

### NPM Packages
- **express** (v4.22.1) - Web server framework
- **axios** (v1.13.2) - HTTP client for external API calls
- **dotenv** (v17.2.3) - Environment variable management (not actively used, API key is hardcoded)

### External APIs
- **ERLC API** (`api.policeroleplay.community/v1/server`) - Game server integration for ban management and server data
- **Roblox Thumbnails API** - Fetches player avatar images for the ban list
- **AllOrigins Proxy** - CORS proxy for Roblox API calls from the frontend

### External Resources
- Google Fonts (Inter, Oswald)
- Font Awesome icons (CDN)
- Discord CDN for gallery images
- Unsplash for background images