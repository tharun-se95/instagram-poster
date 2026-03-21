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

## 5. 🖼️ Pollinations.ai (Phase 2 — Free Image Generation)

**Base URL**: `https://gen.pollinations.ai`
**Auth**: None required for basic use; register at `auth.pollinations.ai` for higher limits

### Image Generation
```
GET https://gen.pollinations.ai/image/{url-encoded-prompt}?model=flux&width=1080&height=1080
```

| Parameter | Values | Notes |
|-----------|--------|-------|
| `model` | `flux`, `gpt-image-large`, `kontext`, `seedream` | Flux = free default; GPT Image = OpenAI quality |
| `width` / `height` | up to 1280 | Default 1024×1024 |
| `seed` | integer | Reproducible outputs |
| `enhance` | `true` / `false` | Auto SPAN 2x upscale |

### Rate Limits
| Tier | Limit |
|------|-------|
| Anonymous | 1 request / 15 seconds |
| Registered (free) | Higher limits + hourly Pollen credit regeneration |
| Secret key (sk_) | No rate limit (server-side only, never expose publicly) |

### Cost
- **Basic**: Free forever, no signup
- **Pollen credits**: $1 ≈ 1 Pollen; earned daily by contributing or bought pay-as-you-go
- Watermarks only removed with registered account

### Key Notes
- No SDK needed — plain HTTP GET
- Client-side apps: IP rate-limited at 1 Pollen/hour
- Use exponential backoff on 429s (1s → 2s → 4s)

---

## 5b. 🖼️ Grok Aurora — xAI Image Generation (Phase 2/3)

**API**: `https://api.x.ai/v1`
**Auth**: `Authorization: Bearer {XAI_API_KEY}` (get key at `console.x.ai`)
**SDK**: `npm install openai` (Aurora uses OpenAI-compatible `/images/generations` endpoint)

### Image Generation
```js
import OpenAI from 'openai';
const xai = new OpenAI({ baseURL: 'https://api.x.ai/v1', apiKey: process.env.XAI_API_KEY });
const response = await xai.images.generate({
  model: 'aurora',
  prompt: 'Photorealistic sunset over a tropical beach',
  n: 1,
  size: '1024x1024'
});
```

### Image Editing (Multimodal Input)
Aurora accepts an existing image as input to edit or extend — unique vs. DALL-E 3:
```js
await xai.images.edit({ model: 'aurora', image: fs.createReadStream('photo.jpg'), prompt: 'Add golden hour lighting' });
```

### Pricing (2026)
| Source | Cost |
|--------|------|
| xAI API direct | ~$0.07/image (verify at console.x.ai) |
| WaveSpeed AI | $0.07/image |
| PoYo.ai | $0.03/image |
| New user credit | $25 free on signup + $150/mo via data sharing program |

### Key Notes
- Aurora is an autoregressive mixture-of-experts model (different architecture from diffusion models)
- Excels at photorealistic rendering and precise instruction following
- Native image-to-image: pass existing photo + text prompt to edit
- xAI API is OpenAI-compatible — drop-in replacement for `openai` SDK calls

---

## 7. 📹 Kling / Seedance (Phase 3 — AI Video)

**Access via**: `fal.ai` (unified AI model API)
**SDK**: `npm install @fal-ai/client`

| Model | Best For | Clip Length | Est. Cost |
|-------|---------|------------|-----------|
| Kling 3.0 Pro | Cost-effective cinematic | Up to 2 min | ~$0.05–0.15/sec |
| Seedance 2.0 | Multi-shot storytelling continuity | ~10s | Credits |
| Google Veo 3 | Film-grade realism + audio (hero) | Minutes | $0.35–0.50/sec |

---

## 8. 🎙️ ElevenLabs (Phase 2/3 — Voice)

**SDK**: `npm install elevenlabs`
| Plan | Price | Characters/mo |
|------|-------|--------------|
| Starter | $5 | 30,000 |
| Creator | $22 | 100,000 |
- Voice clone from 60-second audio sample (Starter+)
- Commercial license on all paid plans

---

## 9. 🎵 Suno AI (Phase 3 — Music)

**API**: Unofficial via `cometapi.com`
- Pro plan: $10/mo → ~2,500 songs, commercial rights
- Designed to avoid copyright takedowns on all platforms
- Prompt example: `"ambient cinematic travel music, no lyrics, uplifting"`
