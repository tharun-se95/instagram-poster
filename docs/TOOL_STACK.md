# Tool Stack Reference
*Chosen tools per layer with rationale, pricing, and integration notes.*

---

## ✅ Currently Implemented

| Tool | Purpose | Integration |
|------|---------|------------|
| `@google/generative-ai` | Gemini Vision (photo scoring, captions) | `server/gemini.js` |
| `better-sqlite3` | Local database (queue, tokens, settings) | `server/db.js` |
| `node-cron` | Scheduled posting (9:07 AM, 6:05 PM) | `server/automation.js` |
| `axios` | HTTP calls (Instagram, Google, bridge) | Throughout |
| `form-data` | Multipart upload to bridge | `server/mediaBridge.js` |
| `express` | REST API server | `server/index.js` |
| `cors` | Frontend–backend communication | `server/index.js` |
| React + Vite | Monitoring dashboard UI | `src/` |
| Framer Motion | Animations | `src/App.jsx` |

---

## 🔲 Phase 2 — Add These

| Layer | Tool | Cost | Why |
|-------|------|------|-----|
| 🎙️ Voice | **ElevenLabs** | $5/mo | Voice clone from 60s sample, Node SDK |
| 🎵 Music | **Suno Pro** via CometAPI | $10/mo | Royalty-free, avoids takedowns |
| 📝 Captions | **faster-whisper** (local) | Free | Word timestamps for animated subs |
| 📊 Analytics | **AssemblyAI** | Pay/min | Audio intelligence on Reel performance |
| 🖼️ Enhance | **Real-ESRGAN** via Replicate | ~$1-3/mo | Auto-upscale Google Photos 4x |
| 🔥 Trends | **pytrends** (Google Trends) | Free | No API key needed |

---

## 🔲 Phase 3 — AI Faceless Video Engine

| Layer | Tool | Cost | Why |
|-------|------|------|-----|
| 🤖 Agents | **CrewAI** (Python) | Free | Research→Script→Direct→Post crew |
| 🔍 Trends | **Apify TikTok API** | Pay/run | Deep trend hashtag analytics |
| 🎬 Video Gen | **Kling 3.0** via fal.ai | ~$0.05–0.15/s | Best cost/cinematic quality ratio |
| 📖 Storytelling | **Seedance 2.0** via fal.ai | Credits | Multi-shot narrative continuity |
| 🎥 Hero Content | **Google Veo 3** (Vertex AI) | $0.35–0.50/s | Film-grade for special content |
| 🎞️ Composition | **FFmpeg** + `fluent-ffmpeg` | Free | Stitch clips, mix audio, burn subs |
| 📹 Stock B-roll | **Pixabay CC0 API** | Free | 5,000 req/hr, full commercial use |

---

## 💰 Monthly Cost Estimate

| Phase | Tools | Cost |
|-------|-------|------|
| Phase 1 (now) | Gemini API calls only | ~$0.03–0.08 |
| Phase 2 | + ElevenLabs + Suno + Replicate | ~$16–20/mo |
| Phase 3 | + Kling/Seedance (50 videos) | ~$31–43/mo |

---

## ⚠️ Key Decisions & Rationale

| Decision | Chosen | Rejected | Reason |
|----------|--------|---------|--------|
| Database | SQLite | Supabase | Tokens stay local, zero latency, no internet dependency |
| Video Gen | Kling 3.0 | Veo 3 (primary) | 10x cheaper; Veo only for hero content |
| Music | Suno | Free Music Archive | Auto-avoids platform copyright takedowns |
| Captions | faster-whisper | AssemblyAI | Free local, word timestamps sufficient |
| Stock footage | Pixabay CC0 | Pexels | Pexels bans AI training use; Pixabay is fully free commercial |
| Agents | CrewAI (Python) | LangChain only | CrewAI is lighter, purpose-built for agent crews |
