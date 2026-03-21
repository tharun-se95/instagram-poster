# API Reference
*All external API specs, limits, and gotchas in one place.*

---

## 1. 📸 Google Photos — Picker API

**Base URL**: `https://photospicker.googleapis.com/v1`
**Scope**: `photospicker.mediaitems.readonly`

> [!WARNING]
> `photoslibrary.readonly` was **deprecated March 31, 2025**. Do NOT use it. Picker API only.

### Flow
| Step | Endpoint | Note |
|------|----------|------|
| Create session | `POST /sessions` | Returns `pickerUri` + `sessionId` |
| Open picker | Open `pickerUri` in browser | User selects photos |
| Poll status | `GET /sessions/{id}` | Look for `mediaItemsSet: true` |
| Fetch items | `GET /mediaItems?sessionId={id}` | Paginate with `nextPageToken` |
| Use `baseUrl` | Append `=w1024` for resolution | **Valid ~60 min only** |
| Cleanup | `DELETE /sessions/{id}` | Good practice |

### Key Details
- `baseUrl` requires `Authorization: Bearer {token}` header to download
- Must bridge to public host before passing to Instagram
- Use `pollingConfig.pollInterval` from session response for polling interval

---

## 2. 📱 Instagram Graph API

**Base URL**: `https://graph.instagram.com/v25.0`
**Required scopes**: `instagram_basic`, `instagram_content_publish`

> [!IMPORTANT]
> Requires **Business or Creator** account linked to a Facebook Page. ~~Personal accounts not supported~~.

### Media Specs
| Type | Format | Aspect Ratio | Max Size |
|------|--------|-------------|----------|
| Feed Image | JPEG only | 4:5 → 1.91:1 | 8MB |
| Reel / Video | MOV/MP4 H.264+AAC | 9:16 recommended | — |
| Carousel | JPEG per item | Fixed to first image | 8MB each |
| Min width | — | 320px | — |
| Max width | — | 1440px | — |

### Publishing Flow
```
POST /{business-id}/media          → creation_id
GET /{creation_id}?fields=status_code  → wait for FINISHED
POST /{business-id}/media_publish  → media_id
```
- **Subcode 2207027**: Media not ready → retry (implemented with backoff)
- **Subcode 2207052**: Invalid URL → ensure bridge URL is a direct `.jpg`

### Rate Limits
| Limit | Value |
|-------|-------|
| Published posts | 100 / 24h |
| Media containers | 400 / 24h |
| API calls | 200 / hour |

---

## 3. 🎥 YouTube Data API

**Upload URL**: `https://www.googleapis.com/upload/youtube/v3/videos`
**Scope**: `https://www.googleapis.com/auth/youtube.upload`

### Shorts Requirements
| Field | Value |
|-------|-------|
| Aspect ratio | **9:16 vertical** (mandatory) |
| Duration | ≤ **60 seconds** |
| Hashtag signal | Include `#Shorts` in title or description |
| Upload type | `resumable` (mandatory for video) |
| Default privacy | Set to `unlisted` until reviewed |

### Metadata Limits
| Field | Limit |
|-------|-------|
| `snippet.title` | 100 chars |
| `snippet.description` | 5000 chars |
| `snippet.tags` | 500 cumulative chars |

---

## 4. 🧠 Gemini Vision API

**SDK**: `@google/generative-ai`
**Model**: `gemini-2.5-flash-preview-04-17`

### Cost
| Model | Per 1M tokens | Est. per 1k photos |
|-------|--------------|-------------------|
| `gemini-2.5-flash-lite` | $0.10 | ~$0.026 |
| `gemini-2.5-flash` | $0.30 | ~$0.08 |

### Prompt Strategy (implemented in `server/gemini.js`)
- Input: image as inline `base64` data
- Output: strict JSON with `aesthetic_score`, `mood`, `subject`, `instagram_ready`, `suggested_caption`, `hashtags[]`, `crop_recommendation`
- Reject if: blurry, NSFW, faces of strangers close-up, screenshots

---

## 5. 📹 Kling / Seedance (Phase 3 — AI Video)

**Access via**: `fal.ai` (unified AI model API)
**SDK**: `npm install @fal-ai/client`

| Model | Best For | Clip Length | Est. Cost |
|-------|---------|------------|-----------|
| Kling 3.0 Pro | Cost-effective cinematic | Up to 2 min | ~$0.05–0.15/sec |
| Seedance 2.0 | Multi-shot storytelling continuity | ~10s | Credits |
| Google Veo 3 | Film-grade realism + audio (hero) | Minutes | $0.35–0.50/sec |

---

## 6. 🎙️ ElevenLabs (Phase 2/3 — Voice)

**SDK**: `npm install elevenlabs`
| Plan | Price | Characters/mo |
|------|-------|--------------|
| Starter | $5 | 30,000 |
| Creator | $22 | 100,000 |
- Voice clone from 60-second audio sample (Starter+)
- Commercial license on all paid plans

---

## 7. 🎵 Suno AI (Phase 3 — Music)

**API**: Unofficial via `cometapi.com`
- Pro plan: $10/mo → ~2,500 songs, commercial rights
- Designed to avoid copyright takedowns on all platforms
- Prompt example: `"ambient cinematic travel music, no lyrics, uplifting"`
