# Knowledge Base — InstaPoster Pro

> 🔄 **AGENT ENTRY POINT**: At the start of every session, run `/dev-cycle` (`.agents/workflows/dev-cycle.md`).
> That workflow tells you exactly what to read, what to build, and what to update before ending the session.
> Persistent lessons learned and project context across agent threads.
> Add to this file whenever a non-trivial bug is solved or a key decision is made.
> Last updated: 2026-03-12

---

## 📌 Project Context

- **Project**: InstaPoster Pro — autonomous Instagram poster from Google Photos
- **Stack**: React 18 + Vite (frontend), Node.js ESM + Express (backend), SQLite, Gemini Flash, Instagram Graph API v25.0
- **Active Server**: Backend runs on `localhost:3001`, Frontend dev on `localhost:5173`
- **Database**: `server/instaposter.db` (SQLite, auto-created on first run)

---

## 🔌 MCP Servers Configured

| Server | Package | Config File | Purpose |
|--------|---------|-------------|---------|
| `filesystem` | `@modelcontextprotocol/server-filesystem` | `.gemini/settings.json` | Read/write project files |
| `sqlite` | `mcp-server-sqlite` | `.gemini/settings.json` | Direct DB queries on `instaposter.db` |
| `fetch` | `mcp-fetch-server` | `.gemini/settings.json` | Test API endpoints (Instagram, Gemini) |
| `playwright` | `@playwright/mcp` | `.gemini/settings.json` | Browser automation for UI verification |
| `mcp-banana` | `@ynzys/mcp-banana` | `.gemini/settings.json` | Multi-image AI generation |
| `research-plugins`| `@wentorai/research-plugins` | `.gemini/settings.json` | TikTok/IG hashtag trends |
| `mcp-deepwiki` | `mcp-deepwiki` | `.gemini/settings.json` | Niche video script sourcing |
| `StitchMCP` | `mcp-remote` | `~/.gemini/antigravity/mcp_config.json` | UI design & prototyping |
| `github-mcp-server` | Docker | `~/.gemini/antigravity/mcp_config.json` | Git, PRs, GitHub ops |
| `mcp-ui` | `@mcp-ui/server` | `~/.gemini/antigravity/mcp_config.json` | Rapid prototyping YouTube dashboard |
| `agent-toolbox`| `agent-toolbox` | `~/.gemini/antigravity/mcp_config.json` | Provenance tracking for media |



---

## 🧠 Lessons Learned

### 2026-03-12 — Workspace Initialization
- The project is fully ESM (`"type": "module"` in both `package.json` files). **Never use `require()`**.
- Google Photos URLs are **private/auth-gated** — Instagram's API cannot access them directly.
- **Solution**: `server/mediaBridge.js` downloads the photo locally, then re-uploads to `tmpfiles.org` to get a public URL before calling the Instagram API.
- `tmpfiles.org` links are ephemeral — they expire. The posting flow must happen quickly after the bridge upload.

### 2026-03-11 — Debugging Server Errors
- 404 errors from the server were caused by missing route registrations in `server/index.js`.
- Content Security Policy violations in the browser occur when the frontend tries to load resources from origins not whitelisted in the server's CSP headers.
- **Fix**: Add the required origin to the CSP `connect-src` and `img-src` directives.

### 2026-03-10 — Media Bridge Implementation
- Instagram's Graph API requires a **publicly accessible URL** for the media container.
- Google Photos share URLs (even with `=d` suffix) are auth-gated and fail Instagram's internal fetch.
- **Chosen bridge**: `tmpfiles.org` (free, no-auth, immediate public URL). Alternative: Cloudinary, AWS S3 presigned URLs.
- Retry logic in `server/instagram.js` polls the container status with exponential backoff until `FINISHED`.

---

## 🔧 Active Configuration

- **Cron schedule**: `9:07 AM` and `6:05 PM` daily (via `node-cron` in `server/automation.js`)
- **AI scoring threshold**: Posts approved if Gemini Flash score ≥ 7/10
- **Instagram API version**: `v25.0`
- **Port mapping**: Backend `3001`, Frontend `5173`

---

## 📋 Open Questions / TODO

- [ ] Gemini API key needs to be set with a real key (currently placeholder)
- [ ] First real end-to-end run not yet tested
- [ ] No authentication on the Express backend — only safe for local use
- [ ] `tmpfiles.org` reliability: consider a fallback (Cloudinary free tier)
- [ ] Phase 2: YouTube Shorts integration design not started

---

## 🗺️ Key Design Decisions

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| Database | SQLite | Simple, zero-setup, perfect for single-server personal tool |
| AI provider | Google Gemini Flash | Free tier, fast, multimodal (can analyze images) |
| Media bridge | tmpfiles.org | Quickest path to public URL with no account needed |
| Frontend | React + Vite + Tailwind | Modern, fast dev experience, works well with Radix UI |
| Module system | ESM throughout | Future-proof, cleaner imports, matches Vite's default |
