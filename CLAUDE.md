# InstaPoster Pro - Claude Code Configuration

This file configures Claude Code to operate optimally in the InstaPoster Pro workspace.
Last updated: 2026-03-21

---

## Product Overview

InstaPoster Pro is an autonomous AI agent that:
1. Curates photos from Google Photos using Gemini Vision scoring
2. Queues approved photos for scheduled Instagram publishing
3. Provides a React dashboard for manual review, editing, and control

**Current Phase**: Phase 1 complete (Google Photos → Instagram). Phase 2 (YouTube Shorts) and Phase 3 (AI faceless videos) are planned.

---

## Agent & Subagent Architecture (CRITICAL)

To complete tasks faster and more efficiently, you MUST heavily utilize agents and subagents:

1. **Aggressive Task Decomposition**: Break every complex feature into isolated, parallelizable sub-tasks (e.g., DB schema, backend service, API route, React UI).
2. **Spawn Parallel Subagents**: Dispatch concurrent subagents for independent modules. Example: one subagent for a new service file while another wires up the route and a third builds the UI card.
3. **Delegation**: Never write all code in a single monolithic pass. Delegate domain logic (media bridging, Instagram API, SQLite queries, image editing) to focused subagents.
4. **Subagent Orchestration**: Your primary role is orchestrating subagents, reviewing output against standards below, and assembling the final feature.

---

## Feature-Driven Workflow (MANDATORY)

1. **Orient FIRST**: Read `docs/MASTER.md` and `docs/BUILD_LOG.md` before any work.
2. **Plan**: Generate `implementation_plan.md` outlining phases and file-level changes.
3. **Present & Wait**: Present the plan to the user and **wait for explicit approval**. Never execute autonomously without confirmation.
4. **Implement**: Follow the `.agents/workflows/dev-cycle.md` dev cycle exactly.
5. **Verify**: Test backend via terminal, frontend via browser. Run `npm run lint` before declaring done.
6. **Persist**: Update `docs/BUILD_LOG.md` and `docs/MASTER.md`. Pre-plan the next 3-5 phases.

---

## Codebase Structure

```
instagram-poster/
├── server/                         # Node.js backend (Express, port 3001)
│   ├── index.js                    # Entry point: Express setup, DB init, scheduler start
│   └── src/
│       ├── api/
│       │   └── routes.js           # All REST endpoints (~428 lines)
│       ├── models/
│       │   └── db.js               # SQLite schema, CRUD, migrations (~208 lines)
│       ├── services/
│       │   ├── automationService.js   # Curation loop + cron scheduler
│       │   ├── geminiService.js       # Gemini Flash vision analysis
│       │   ├── instagramService.js    # Instagram Graph API posting
│       │   ├── mediaBridgeService.js  # Google Photos → tmpfiles.org bridge
│       │   ├── sharpEditingService.js # Sharp.js image editing (AI param resolution)
│       │   └── editingService.js      # Edited image cache management
│       └── utils/
│           └── logger.js           # Pino logger wrapper
├── src/                            # React frontend (Vite, port 5173)
│   ├── App.jsx                     # Complete dashboard (~1,028 lines, all state here)
│   ├── main.jsx
│   ├── index.css                   # TailwindCSS + .glass-card dark theme
│   ├── api/
│   │   ├── googlePhotos.js         # OAuth flow, Picker session management
│   │   ├── instagram.js            # Legacy (reference only, server-side now)
│   │   └── mediaBridge.js          # Legacy (reference only, server-side now)
│   ├── components/
│   │   ├── PhotoPicker.jsx         # Google Picker modal wrapper
│   │   ├── shared.jsx              # StatCard, EmptyState, SectionHeader, ServerStatusDot
│   │   └── ui/                     # ShadCN components
│   │       ├── button.jsx          # Variants: default, secondary, outline, ghost, destructive
│   │       ├── card.jsx
│   │       ├── badge.jsx           # Status badges auto-mapped from queue status
│   │       ├── tabs.jsx            # Radix UI tabs
│   │       └── primitives.jsx      # Switch, Separator, Tooltip, Avatar
│   └── lib/
│       └── utils.js
├── docs/
│   ├── MASTER.md                   # Single source of truth: roadmap, env vars, feature status
│   ├── BUILD_LOG.md                # Session-by-session progress log
│   ├── API_REFERENCE.md            # External API specs (Google, Instagram, Gemini, YouTube)
│   ├── RULES.md                    # Project conventions
│   └── TOOL_STACK.md               # Tool choices per layer (current + planned)
├── .agents/
│   ├── workflows/
│   │   ├── dev-cycle.md            # 5-phase dev workflow (MUST follow)
│   │   ├── audit.md
│   │   ├── deploy.md
│   │   └── review.md
│   └── rules/
│       ├── coding-standards.md     # Frontend/backend/DB coding rules
│       └── system-behavior.md      # Planning, verification, safety rules
├── architecture.md                 # System architecture diagram + data flow
├── knowledge.md                    # Accumulated gotchas and learnings
├── package.json                    # Frontend deps (React 18, Vite 8, TailwindCSS 3.4)
├── tailwind.config.js
├── vite.config.js
└── instaposter.db                  # SQLite database (runtime, not committed)
```

**Runtime-generated files (not in git):**
- `instaposter.db`, `instaposter.db-shm`, `instaposter.db-wal` — SQLite + WAL files
- `uploads/thumbnails/{id}.jpg` — Cached photo thumbnails
- `uploads/edited/{id}.jpg` — Smart Edit results

---

## Database Schema

**Table: `media_queue`** — Core queue
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| google_base_url | TEXT | Private Google Photos URL (auth-gated) |
| original_width / original_height | INTEGER | Source dimensions |
| ai_score | INTEGER | Gemini score 1-10 |
| mood | TEXT | travel/lifestyle/nature/urban/food/portrait/abstract |
| subject | TEXT | Primary subject |
| suggested_caption | TEXT | AI-generated caption with emojis |
| hashtags | TEXT | JSON array, up to 20 tags |
| crop_recommendation | TEXT | Aspect ratio suggestion |
| editing_suggestions | TEXT | JSON array of 3-5 natural-language tips |
| sharp_params | TEXT | JSON Sharp.js params {brightness, contrast, saturation, warmth, sharpen, denoise, clahe} |
| status | TEXT | PENDING/APPROVED/REJECTED/POSTING/POSTED/FAILED |
| rejection_reason | TEXT | Set when status=REJECTED |
| scheduled_at | TEXT | Cron-assigned time |
| posted_at | TEXT | Actual post timestamp |
| platform | TEXT | Default: INSTAGRAM |
| platform_post_id | TEXT | IG container/post ID |
| created_at | TEXT | Auto-set |

**Other tables:** `oauth_tokens`, `post_metrics`, `settings`

**All DB access goes through `server/src/models/db.js` exclusively.**

---

## API Routes (server/src/api/routes.js)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /health | Server status |
| GET | /stats | Dashboard stats |
| GET | /queue | Queue with filters (status, limit, created_after) |
| POST | /auth/google | Store Google access token (in-memory) |
| POST | /curate | Start Gemini curation batch |
| POST | /queue/:id/approve | Manual approval |
| POST | /queue/:id/reject | Manual rejection |
| PATCH | /queue/:id/caption | Update caption |
| GET | /queue/:id/thumbnail | Cached thumbnail image |
| POST | /queue/:id/edit | Start Smart Edit (Sharp) |
| GET | /queue/:id/edited-status | Poll edit progress |
| GET | /queue/:id/edited-image | Retrieve edited image |
| DELETE | /queue/:id/edit | Discard edited version |
| POST | /queue/:id/reanalyze | Per-card Gemini re-analysis |
| POST | /reanalyze-approved | Batch re-analyze all APPROVED |
| GET | /reanalyze-approved/progress | Batch progress polling |
| POST | /post/:id | Force post specific item now |
| GET | /posting-progress/:id | In-flight posting progress |
| POST | /pause-scheduler | Pause cron jobs |
| POST | /resume-scheduler | Resume cron jobs |

---

## Key Data Flow

```
Google Picker (OAuth) → POST /curate
  → downloadForAnalysis() [Google Bearer token]
  → analyzePhoto() [Gemini Flash: score, caption, sharp_params]
  → score ≥ 7 && instagram_ready → APPROVED; else REJECTED
  → insertQueueItem() → SQLite
  → save thumbnail to uploads/thumbnails/

Cron (9:07 AM + 6:05 PM daily) → runPostingCycle()
  → getNextPendingPost() [highest-scored APPROVED]
  → load edited image OR thumbnail OR re-download from Google
  → cropToInstagramRatio() [ensure 4:5 / 0.8-1.91:1 range]
  → bridgeToPublic() [upload to tmpfiles.org → get public URL]
  → postImage() [create IG container → poll FINISHED → publish]
  → updateStatus('POSTED', { platform_post_id, posted_at })
```

---

## Coding Conventions

### Language & Modules
- **Both frontend and backend use ESM** (`import`/`export`). The backend `server/package.json` has `"type": "module"`.
- No TypeScript unless explicitly asked.

### Backend (`/server`)
- Each service file has one responsibility.
- All DB calls go through `server/src/models/db.js` — never query SQLite directly in routes or services.
- Always wrap async functions in `try/catch`. Log errors as `[ModuleName] Error: <message>` using the pino logger.
- Parameterized queries only — no raw SQL string concatenation.
- Route handlers stay thin; business logic belongs in `/services`.

### Frontend (`/src`)
- Functional React components only. PascalCase filenames. Keep components under ~200 lines.
- All state lives in `App.jsx` (no Redux, no Zustand).
- API calls via `axios` using `import.meta.env.VITE_SERVER_URL` as the base URL.
- Never make direct calls to Instagram, Google, or Gemini APIs from the frontend — route through the backend.

### Styling
- TailwindCSS v3 utility classes throughout.
- `.glass-card` for the dark glassmorphism card style.
- Dark theme: navy header, purple accents (`#6c5ce7`), slate text.
- ShadCN components from `src/components/ui/` — do not bypass with raw HTML.
- Framer Motion for animations. Lucide React for icons. Sonner for toast notifications.

---

## Security & Environment

- **Never commit `.env`**.
- **No raw SQL**: Always use parameterized queries (`better-sqlite3` prepared statements).
- **Token Security**: Keep OAuth access tokens in-memory only (closure variable in routes.js). Never write them to disk or the DB unencrypted.
- **No authentication on the Express backend** — assumes trusted local network.
- When adding new environment variables, document them in `docs/MASTER.md`.

**Required `.env` variables:**
```
VITE_GOOGLE_CLIENT_ID
VITE_GOOGLE_CLIENT_SECRET
VITE_INSTAGRAM_ACCESS_TOKEN
VITE_INSTAGRAM_BUSINESS_ID
VITE_IG_API_VERSION=v25.0
VITE_GEMINI_API_KEY
SERVER_PORT=3001
VITE_SERVER_URL=http://localhost:3001
```

---

## Common Commands

```bash
# Start backend (Terminal 1)
cd server && node index.js
# or with auto-restart:
cd server && npm run dev

# Start frontend (Terminal 2)
npm run dev

# Lint
npm run lint

# Build for production
npm run build
```

---

## Critical Gotchas

1. **Google Photos URLs are auth-gated** — must bridge via `tmpfiles.org` before passing to Instagram. Direct URLs will 403.
2. **tmpfiles.org links are ephemeral** — post to Instagram immediately after bridging; don't cache the public URL.
3. **Instagram aspect ratio is strict** — must be 0.8:1 to 1.91:1. `cropToInstagramRatio()` auto-crops to 4:5. Skipping this causes container creation to fail.
4. **Gemini free tier: ~20 requests/day** — quota exhaustion is expected in large batches. The batch re-analyze route detects 429s and reports partial progress.
5. **No Express auth** — the server is intentionally unauthenticated, designed for localhost only.
6. **Google Photos Picker API only** — the deprecated `photoslibrary.readonly` scope was sunset March 31, 2025. Only use the new Picker API session flow.
7. **Instagram Business Account required** — personal accounts cannot use the Graph API publisher.
8. **Sharp.js param resolution is three-tier**: (1) cached `sharp_params` from DB, (2) Gemini text parsing of `editing_suggestions`, (3) offline keyword fallback. Always check DB first.
9. **SQLite WAL mode** — creates `.db-shm` and `.db-wal` sidecar files. Add these to `.gitignore` if not already present.
10. **Schema migrations use safe `ALTER TABLE ... ADD COLUMN`** — never drop or rename columns.

---

## Current Development Status (as of 2026-03-21)

### Completed (Phase 1)
- React dashboard with queue management tabs (PENDING/APPROVED/REJECTED/POSTED/FAILED)
- Node.js/Express backend on port 3001
- SQLite database with full schema
- Gemini Flash vision scoring + caption generation
- Google Photos Picker integration (OAuth)
- Media bridge (Google Photos → tmpfiles.org → Instagram)
- Instagram image + reel posting with retry logic
- Cron scheduler (9:07 AM + 6:05 PM daily)
- Sharp.js smart editing with Gemini-derived params
- Per-card and batch re-analyze features

### Planned (Phase 2)
- YouTube Shorts uploader (`server/src/services/youtubeService.js`)
- Image generation via Pollinations.ai (Flux)
- Instagram Insights analytics (post_metrics table is ready)
- Batch Smart Edit feature
- ElevenLabs voice narration for Reels

### Planned (Phase 3)
- AI faceless video generation (Kling/Seedance/Veo 3)
- Python CrewAI agent layer
- TikTok cross-posting (Apify)

---

## Workflow References

- **Dev cycle**: `.agents/workflows/dev-cycle.md` — 5 phases (Orient → Review → Plan → Implement → Verify → Persist)
- **Coding rules**: `.agents/rules/coding-standards.md`
- **Agent behavior**: `.agents/rules/system-behavior.md`
- **Roadmap**: `docs/MASTER.md`
- **Session log**: `docs/BUILD_LOG.md`
- **API specs**: `docs/API_REFERENCE.md`
- **Tool choices**: `docs/TOOL_STACK.md`
