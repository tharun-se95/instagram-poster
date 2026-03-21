# InstaPoster Pro — Architecture Blueprint
> High-level system design for the Antigravity agent to reference.
> Last updated: 2026-03-12 | Source of truth: `docs/MASTER.md`

---

## 🎯 Product Definition

An **autonomous AI agent** that:
1. Curates photos from **Google Photos** using AI scoring (Gemini Vision)
2. Generates captions and hashtags automatically
3. Posts daily to **Instagram** via the Graph API on a cron schedule
4. *(Phase 3)* Creates AI-generated faceless videos for niche channels → posts to YouTube Shorts

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     REACT FRONTEND (Vite)                       │
│  src/App.jsx — Dashboard: Queue, Stats, Approve/Reject          │
│  src/components/PhotoPicker.jsx — Google Photos Picker modal    │
│  src/api/googlePhotos.js — Google OAuth + Picker session        │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP (axios) → port 3001
┌───────────────────────▼─────────────────────────────────────────┐
│                  NODE.JS BACKEND (Express)                       │
│  server/index.js — Route definitions + server bootstrap         │
│  server/automation.js — Curation loop + node-cron scheduler     │
│  server/db.js — All SQLite read/write operations                │
│  server/gemini.js — Gemini Flash: score + caption + hashtags    │
│  server/instagram.js — Instagram Graph API: post + poll         │
│  server/mediaBridge.js — Google URLs → tmpfiles.org public URL  │
└──────────┬────────────────────────┬────────────────────────────┘
           │                        │
    ┌──────▼──────┐         ┌───────▼──────────┐
    │ SQLite DB   │         │  External APIs   │
    │ instaposter │         │ • Google Photos  │
    │ .db         │         │ • Gemini Flash   │
    │             │         │ • tmpfiles.org   │
    │ Tables:     │         │ • Instagram v25  │
    │ • schema    │         └──────────────────┘
    │ • queue     │
    │ • tokens    │
    │ • settings  │
    └─────────────┘
```

---

## 📁 File Responsibilities

| File | Responsibility |
|------|---------------|
| `src/App.jsx` | Main dashboard — photo queue, status display, approve/reject actions |
| `src/components/PhotoPicker.jsx` | Google Photos Picker UI modal |
| `src/api/googlePhotos.js` | Google OAuth token management, Picker API session |
| `server/index.js` | Express router, CORS, all `/api/*` route handlers |
| `server/automation.js` | `node-cron` schedules (9:07 AM, 6:05 PM), curation orchestration |
| `server/db.js` | All `better-sqlite3` queries — CRUD for queue, tokens, settings |
| `server/gemini.js` | Calls Gemini Flash with photo URL → returns score, mood, caption, hashtags |
| `server/instagram.js` | Creates media container, polls for FINISHED, publishes post |
| `server/mediaBridge.js` | Downloads photo from Google → uploads to tmpfiles.org → returns public URL |

---

## 🔄 Data Flow (End-to-End)

```
1. User opens React Dashboard
2. User clicks "Select Photos" → Google Picker modal opens (src/components/PhotoPicker.jsx)
3. User selects photos → POST /api/curate (server/index.js)
4. server/automation.js loops through photos:
   a. Calls server/gemini.js → AI scores images (1-10), generates captions
   b. Approved (score ≥ 7) → saved to SQLite queue table (server/db.js)
   c. Rejected → logged as REJECTED in DB
5. node-cron fires at 9:07 AM or 6:05 PM:
   a. server/mediaBridge.js fetches photo from Google → uploads to tmpfiles.org
   b. server/instagram.js creates IG media container with public URL
   c. Polls until container status = FINISHED
   d. Publishes post → saves platform_post_id to DB
6. Dashboard polls /api/queue to show POSTED status
```

---

## ⚙️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | React | 18.2 |
| Build tool | Vite | 5.2 |
| Styling | TailwindCSS | 3.4 |
| UI primitives | Radix UI | various |
| Animations | Framer Motion | 11 |
| Notifications | Sonner | latest |
| Backend runtime | Node.js | ESM |
| HTTP server | Express | latest |
| Database | SQLite (better-sqlite3) | latest |
| Scheduler | node-cron | latest |
| AI Vision | Google Gemini Flash | latest |
| Social API | Instagram Graph API | v25.0 |
| Media hosting | tmpfiles.org | (temp bridge) |

---

## 🔑 Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | Frontend | Google OAuth app client ID |
| `VITE_GOOGLE_CLIENT_SECRET` | Frontend | Google OAuth secret |
| `VITE_INSTAGRAM_ACCESS_TOKEN` | Server | Long-lived IG access token |
| `VITE_INSTAGRAM_BUSINESS_ID` | Server | IG Business account ID |
| `VITE_IG_API_VERSION` | Server | `v25.0` |
| `VITE_GEMINI_API_KEY` | Server | Gemini Flash API key |
| `SERVER_PORT` | Server | `3001` |
| `VITE_SERVER_URL` | Frontend | `http://localhost:3001` |

---

## 🚀 Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Backend server + DB | ✅ Done |
| 1 | Gemini photo curation | ✅ Done |
| 1 | Instagram posting + scheduling | ✅ Done |
| 1 | React monitoring dashboard | ✅ Done |
| 1 | Media Bridge (Google → public URL) | ✅ Done |
| 1 | First real end-to-end run | 🔲 Next |
| 2 | YouTube Shorts uploader | 🔲 Planned |
| 2 | Instagram Insights analytics | 🔲 Planned |
| 2 | ElevenLabs voice for Reels | 🔲 Planned |
| 3 | CrewAI agent orchestration | 🔲 Future |
| 3 | AI faceless video pipeline | 🔲 Future |
| 3 | Google Trends topic selection | 🔲 Future |

---

## ⚠️ Known Constraints & Decisions

1. **tmpfiles.org as Media Bridge** — Google Photos URLs are private/auth-gated. We temporarily re-host via tmpfiles.org to get a public URL Instagram can access. This is ephemeral; files expire after a short time.
2. **SQLite** — chosen for simplicity (single server, no cloud DB). If multi-server or high scale is needed → migrate to PostgreSQL or Firestore.
3. **No auth layer on backend** — the Express server has no authentication middleware. It is assumed to run locally. Before any public deployment, add auth.
4. **ESM throughout** — both frontend (Vite) and backend (`"type": "module"`) use ES Modules. Avoid CommonJS `require()`.
