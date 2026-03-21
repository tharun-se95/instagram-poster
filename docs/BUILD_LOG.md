# Build Log
*Updated at the end of every session via `/dev-cycle` — Phase 5: Persist.*

> 🔄 **AGENT WORKFLOW**: Run `/dev-cycle` at session start. Read the latest `## Session N` block during Phase 1 — Review, then add a new block during Phase 5 — Persist.


---

## Session 1 — March 10–11, 2026

### Accomplished
- Built initial Google Photos → Instagram poster (manual, frontend-only)
- Google Picker API integration (session, poll, fetch)
- Media Bridge: Google Photos private URL → tmpfiles.org → public URL
- Instagram Graph API integration: create container → publish with retry

### Files Created
- `src/api/googlePhotos.js` — Google Picker auth + session flow
- `src/api/mediaBridge.js` — temporary public URL bridge
- `src/api/instagram.js` — Instagram Graph API posting
- `src/App.jsx` — original manual UI
- `src/components/PhotoPicker.jsx` — Picker modal

---

## Session 2 — March 12, 2026

### Accomplished
- Scaffolded full Node.js backend with Express
- Built SQLite database with 4 tables: `media_queue`, `oauth_tokens`, `post_metrics`, `settings`
- Integrated Gemini Flash Vision for photo scoring + caption generation
- Built server-side automation loop (curation + scheduling)
- Rebuilt App.jsx as AI monitoring dashboard with:
  - Live stats (total/pending/approved/posted/rejected)
  - Queue viewer with filter tabs
  - Approve / Reject / Regenerate caption per item
  - Post Now button + Pause/Resume scheduler
  - Toast notifications + server online/offline badge
- Rebuilt index.css as dark glassmorphism dashboard design system
- Added `VITE_GEMINI_API_KEY` + `SERVER_PORT` + `VITE_SERVER_URL` to `.env`
- Created `/docs` folder with all documentation

### Files Created / Modified
- `server/index.js` — Express server, all REST routes
- `server/automation.js` — curation loop + cron scheduler
- `server/db.js` — SQLite schema + all operations
- `server/gemini.js` — Gemini Vision analysis + caption regen
- `server/instagram.js` — image + Reel posting with retry
- `server/mediaBridge.js` — server-side bridge
- `src/App.jsx` — full rebuild as dashboard
- `src/index.css` — full rebuild as dark design system
- `.env` — added Gemini + server vars
- `docs/` — all documentation

### Research Completed
- Google Photos Picker API — full flow, deprecation notes
- Instagram Graph API — rate limits, specs, publishing flow
- YouTube Data API — Shorts specs, upload flow
- Gemini pricing — ~$0.026 per 1k photos
- AutoShorts.ai competitive analysis
- Tool ecosystem research (ElevenLabs, Suno, Kling, Seedance, CrewAI, etc.)

### Known Blockers
- `VITE_GEMINI_API_KEY` not yet set → **must add real key before first run**
- Full end-to-end test not done yet

---

## Session 3 — March 18, 2026 (Full Day)

### Accomplished

**Live Progress Overlay (confirmed working)**
- Root cause: POSTING items filtered out from APPROVED tab by status query
- Fix: `fetchData` now merges POSTING + APPROVED items when on APPROVED tab
- Cards show animated progress bar + step checklist while posting is in-flight

**Instagram Aspect Ratio Auto-Crop**
- All posts were failing with "aspect ratio" IG error (images like 2.22:1 and 0.45:1)
- Added `cropToInstagramRatio(buffer)` in `mediaBridgeService.js` using `sharp`
- Called before every bridge upload in `automationService.js`
- Wide (>1.91:1) → crop width; Tall (<0.8:1) → crop height; center-crop always

**Archive API Fix**
- `archivePost()` was failing with "comment_enabled is required"
- Added `comment_enabled: 'true'` param to archive call in `instagramService.js`

**Bridge Upload Timeout**
- `tmpfiles.org` had no timeout — could hang indefinitely
- Added `timeout: 30000` to both `bridgeFromBuffer` and `bridgeToPublic`

**Editing Suggestions Feature (fully working)**
- Gemini `CURATION_PROMPT` now returns `editing_suggestions[]` — 3–5 photo-specific instructions
- Prompt explicitly requires image-observation-driven suggestions (no generic examples)
- `editing_suggestions TEXT` column added to `media_queue` via safe ALTER TABLE migration
- `insertQueueItem` stores as JSON; `GET /api/queue` parses alongside hashtags
- `EditingSuggestions` collapsible pill in App.jsx: Wand2 icon, "N tips" badge, purple styling
- Gemini free tier limit (20 req/day) means suggestions populate as new photos are analyzed

**Re-analyze All Feature (infrastructure built)**
- `POST /api/reanalyze-approved` — triggers batch Gemini re-analysis of all APPROVED items
- `GET /api/reanalyze-approved/progress` — progress polling endpoint
- Smart quota detection: stops batch immediately on `GenerateRequestsPerDay` error vs retrying
- `updateQueueItemAnalysis(id, fields)` DB function — updates AI fields without touching status
- `db.js` updated with `updateQueueItemAnalysis()` function
- Frontend: "Re-analyze All" button in APPROVED tab header with live progress bar
- Amber warning card shows when daily quota is exhausted (with auto-dismiss)
- 16/17 APPROVED items have cached thumbnails in `uploads/thumbnails/`

### Files Modified
- `server/src/services/mediaBridgeService.js` — `cropToInstagramRatio()`, bridge timeouts
- `server/src/services/automationService.js` — crop before bridge, editing_suggestions
- `server/src/services/instagramService.js` — archive fix, onProgress
- `server/src/services/geminiService.js` — CURATION_PROMPT with editing_suggestions (image-specific)
- `server/src/models/db.js` — editing_suggestions migration, insertQueueItem, updateQueueItemAnalysis
- `server/src/api/routes.js` — reanalyze endpoints, quota detection, editing_suggestions parse
- `src/App.jsx` — POSTING+APPROVED merge, EditingSuggestions component, Re-analyze All UI

### Known Issues
- Gemini free tier: 20 req/day — quota exhausted during session; resets at midnight Pacific
- One APPROVED item (id: 4193108d) has no thumbnail cache — Google token expired
- `updateQueueItemAnalysis` updates `ai_score` — could change score for existing APPROVED items (intentional: keeps scores fresh)

---

## Session 4 — March 19, 2026

### Accomplished

**Nano Banana 2 Integration (built but requires paid billing)**
- Created `server/src/services/editingService.js` — Nano Banana 2 (`gemini-3.1-flash-image-preview`) image editing
- Added edit routes to `routes.js`: POST/GET/DELETE `/queue/:id/edit`, GET `/queue/:id/edited-status`, GET `/queue/:id/edited-image`
- Updated `automationService.js`: uses edited image (3-tier priority: edited → cache → Google Photos) when posting
- Added Auto-Edit UI to `App.jsx`: per-card button with poll loop, before/after toggle, `EditStatusBadge`
- Confirmed Nano Banana 2 model ID via `ai.models.list()` — free tier quota = 0 (paid plan required)

**Sharp-Based Free AI Editing (FULLY WORKING ✅)**
- Created `server/src/services/sharpEditingService.js` — two-stage intelligent editor:
  1. **Gemini text model** (free, 20/day) parses suggestions → Sharp.js params JSON
  2. **Keyword fallback parser** (zero API calls) handles brightness/contrast/saturation/warmth/sharpen/clahe/denoise from suggestion text patterns
  3. **Sharp.js** applies all params locally — fully free, no quota, instant
- Pipeline: `modulate()` → `linear()` contrast → `tint()` warmth → `clahe()` → `sharpen()` → `median()` denoise
- Output: quality-92 JPEG saved to `uploads/edited/{id}.jpg`
- Verified end-to-end: `editStatus: done` in 60ms, 542KB output from 419KB input
- Keyword parser correctly extracted: `{ brightness: 0.12, warmth: 12, saturation: 0.22, sharpen: 0.8 }` from 5 natural-language suggestions
- `routes.js` updated to use `sharpEditAndSave` (was `editAndSave` from Nano Banana service)
- App.jsx button renamed from "Auto-Edit" → "Smart Edit" (uses `Wand2` icon)

**Research: Free alternatives to Nano Banana 2**
- Sharp (already installed): Best free editing — local, covers 90% of editing suggestions
- Pollinations.ai: Free image generation (Flux quality), no API key, 1 image/hour
- Hugging Face: $0.10/month free budget (~80–100 FLUX generations)

### Files Created / Modified
- `server/src/services/sharpEditingService.js` — NEW: Sharp + keyword parser + Gemini text parser
- `server/src/services/editingService.js` — NEW: Nano Banana 2 integration (kept for future paid use)
- `server/src/api/routes.js` — edit routes + reanalyze routes + sharpEditAndSave
- `server/src/models/db.js` — `updateQueueItemAnalysis()` function
- `server/src/services/automationService.js` — 3-tier image priority for posting
- `src/App.jsx` — Smart Edit button + EditStatusBadge + Re-analyze All UI

### Known Issues
- Gemini free tier (20 req/day text, 0 image) — quota may be exhausted; Sharp keyword parser provides full fallback
- Nano Banana 2 / Gemini image editing requires paid Gemini billing (aistudio.google.com → Billing)

---

## Session 5 — March 19, 2026

### Accomplished

**Gemini Vision → Direct Sharp Params (FULLY WORKING ✅)**
- Updated `CURATION_PROMPT` in `geminiService.js` to return `sharp_params` JSON directly alongside natural-language `editing_suggestions`
- Gemini vision now machine-reads the image and outputs exact Sharp.js values (brightness, contrast, saturation, warmth, sharpen, denoise, clahe)
- Added `sharp_params TEXT` column to `media_queue` via safe ALTER TABLE migration
- Updated `insertQueueItem` and `updateQueueItemAnalysis` in `db.js` to store `sharp_params`
- Updated `GET /api/queue` to parse `sharp_params` alongside hashtags/editing_suggestions
- Updated edit route to pass `sharp_params` to `sharpEditAndSave` (shows "Editing started (Gemini vision params)" vs "keyword parser")
- Updated reanalyze batch route to store `analysis.sharp_params`
- Updated `automationService.js` to pass `sharp_params` to `insertQueueItem`

**Three-tier Sharp Param Resolution (Priority)**
1. Gemini vision `sharp_params` stored in DB → used directly, zero extra API calls
2. Gemini text parses natural-language suggestions → JSON params
3. Keyword parser (fully offline) → scans suggestion text for brightness/contrast/saturation/warmth/sharpen/clahe/denoise patterns

**Per-Card Re-analyze Feature (NEW ✅)**
- Added `POST /api/queue/:id/reanalyze` route in `routes.js`:
  - Fetches image from local thumbnail cache or downloads from Google Photos
  - Calls `analyzePhoto()` for fresh Gemini analysis including new `sharp_params`
  - Updates DB via `updateQueueItemAnalysis()` — preserves status, updates all AI fields
  - Returns `{ success, score, subject }`
- Added Re-analyze button (🔄 AI) to QueueCard action row in `App.jsx`:
  - Appears for both PENDING and APPROVED items
  - Shows spinner while awaiting (synchronous — waits for Gemini response)
  - On success: toast + `onRefresh()` to reload card data
  - On failure: shows Gemini error in toast (handles quota exhausted gracefully)

### Files Modified
- `server/src/services/geminiService.js` — `CURATION_PROMPT` with `sharp_params` block
- `server/src/models/db.js` — `sharp_params` column migration, `insertQueueItem`, `updateQueueItemAnalysis`
- `server/src/api/routes.js` — new `/queue/:id/reanalyze` route, edit route passes `sharp_params`, reanalyze batch stores `sharp_params`
- `server/src/services/automationService.js` — passes `sharp_params` to `insertQueueItem`
- `server/src/services/sharpEditingService.js` — `resolveParams()` priority system
- `src/App.jsx` — Re-analyze button in QueueCard, `reanalyzing` state

### Known Issues
- Gemini free tier: 20 req/day — quota may be exhausted; re-analyze will show a toast error
- Existing items (analyzed before Session 5) have `sharp_params = null`; re-analyze them to get fresh params
- Per-card re-analyze is synchronous (blocks ~5s per Gemini call); batch uses background loop

---

## Session 6 — (Next Session)

### Start Here
1. Start backend: `cd server && node index.js` (from project root)
2. Start frontend: `npm run dev`
3. Test per-card "🔄 AI" button on any APPROVED/PENDING card
4. After re-analysis: "Smart Edit" should now use Gemini vision params (faster, more accurate)

### Next Features to Build (Priority Order)
- [ ] **Image generation via Pollinations.ai** — generate alternative images for captions/posts (free, Flux quality)
- [ ] **YouTube Shorts uploader** — `server/src/services/youtubeService.js`
- [ ] **Instagram Insights analytics** — fetch likes/reach/saves for POSTED items
- [ ] **Batch Smart Edit** — "Edit All APPROVED" button that runs sharpEditAndSave on all items
- [ ] **ElevenLabs voice narration** — for Reels

---

*Add a new `## Session N` block at the start of each new coding session.*
