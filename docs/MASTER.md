# InstaPoster Pro — Master Reference
*Single source of truth. Update this file as the project evolves.*

---

## 🎯 Product in One Line
An autonomous AI agent that curates photos from Google Photos, generates content, and posts daily to Instagram & YouTube — then creates fully AI-generated faceless videos for niche channels.

---

## 📍 Current Status (March 2026)

| Area | Status | Notes |
|------|--------|-------|
| React Frontend | ✅ Built | Dashboard with queue, stats, approve/reject |
| Node.js Backend | ✅ Built | Express server on port 3001 |
| SQLite Database | ✅ Built | schema, queue, tokens, settings tables |
| Gemini Vision | ✅ Built | Photo scoring + caption generation |
| Media Bridge | ✅ Built | Google Photos → tmpfiles.org → Instagram |
| Instagram Posting | ✅ Built | Image + Reel, with retry logic |
| Cron Scheduler | ✅ Built | 9:07 AM + 6:05 PM daily |
| Docs Folder | ✅ Built | `/docs` in project root |
| YouTube Uploader | 🔲 Phase 2 | YouTube Data API integration |
| AI Faceless Videos | 🔲 Phase 3 | Script → Voice → Kling → FFmpeg → Post |
| CrewAI Agents | 🔲 Phase 3 | Python microservice for orchestration |

---

## 🏗️ Architecture

```
User selects photos via Google Picker
  ↓
[React Dashboard] → POST /api/curate → [Node.js Server]
  ↓
[Gemini Flash] — analyzes each photo: score, mood, caption, hashtags
  ↓
SQLite: APPROVED (score ≥ 7) or REJECTED
  ↓
[node-cron @ 9:07AM / 6:05PM]
  ↓
[Media Bridge] — download from Google → upload to tmpfiles.org → public URL
  ↓
[Instagram Graph API] — create container → poll FINISHED → publish
  ↓
SQLite: status = POSTED, platform_post_id saved
```

---

## 📁 Project Structure

```
instagram-poster/
├── src/                    # React frontend
│   ├── App.jsx             # Main dashboard
│   ├── index.css           # Dark design system
│   ├── api/
│   │   ├── googlePhotos.js # Google Picker auth + session
│   │   ├── instagram.js    # (legacy, kept for reference)
│   │   └── mediaBridge.js  # (legacy, kept for reference)
│   └── components/
│       └── PhotoPicker.jsx # Google Photos Picker modal
├── server/                 # Node.js backend
│   ├── index.js            # Express server + all API routes
│   ├── automation.js       # Curation loop + scheduling
│   ├── db.js               # SQLite operations
│   ├── gemini.js           # Gemini Vision API
│   ├── instagram.js        # Instagram Graph API
│   ├── mediaBridge.js      # Public URL bridge
│   └── instaposter.db      # SQLite database (auto-created)
├── docs/                   # Documentation (this folder)
│   ├── MASTER.md           ← You are here
│   ├── API_REFERENCE.md    # All external API specs
│   ├── TOOL_STACK.md       # Recommended tool ecosystem
│   ├── COMPETITIVE.md      # AutoShorts.ai analysis
│   └── BUILD_LOG.md        # Progress log per session
├── .env                    # API keys
└── package.json            # Frontend deps
```

---

## 🔑 Environment Variables (.env)

| Key | Required | Status |
|-----|----------|--------|
| `VITE_GOOGLE_CLIENT_ID` | ✅ | Set |
| `VITE_GOOGLE_CLIENT_SECRET` | ✅ | Set |
| `VITE_INSTAGRAM_ACCESS_TOKEN` | ✅ | Set |
| `VITE_INSTAGRAM_BUSINESS_ID` | ✅ | Set |
| `VITE_IG_API_VERSION` | ✅ | v25.0 |
| `VITE_GEMINI_API_KEY` | ⚠️ | **Needs real key** — [Get here](https://aistudio.google.com/app/apikey) |
| `SERVER_PORT` | ✅ | 3001 |
| `VITE_SERVER_URL` | ✅ | http://localhost:3001 |

---

## 🚀 How to Run

```bash
# Terminal 1 — Backend
cd server && node index.js

# Terminal 2 — Frontend
npm run dev       # opens on http://localhost:5173
```

---

## 📅 Roadmap

### Phase 1 — Personal Photo Automation (CURRENT)
- [x] Backend server + DB
- [x] Gemini photo curation
- [x] Instagram posting + scheduling
- [x] React monitoring dashboard
- [ ] Add Gemini API key and do first real run
- [ ] Test full end-to-end cycle

### Phase 2 — Expansion
- [ ] YouTube Shorts uploader
- [ ] Post performance analytics (Instagram Insights API)
- [ ] Multi-niche / series tagging on batches
- [ ] ElevenLabs voice for Reels narration

### Phase 3 — AI Faceless Video Engine
- [ ] CrewAI: ResearchAgent → ScriptAgent → DirectorAgent
- [ ] Google Trends integration for topic selection
- [ ] Kling / Seedance for AI video clip generation
- [ ] FFmpeg pipeline: clips + voice + music + captions → final video
- [ ] Auto-post to Instagram Reels + YouTube Shorts
