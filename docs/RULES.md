# Project Rules & Context
*Operating manual for the project. Read this as part of the `/dev-cycle` Phase 0 orientation.*

> 🔄 **AGENT WORKFLOW**: Always run `/dev-cycle` at session start. It orchestrates when and how to use this file.


---

## 🤖 AI Session Rules (for resuming work)

1. **Always read `MASTER.md` first** — check current status table before making decisions
2. **Always read `BUILD_LOG.md`** — find the latest session and continue from "Next Features"
3. **Update `BUILD_LOG.md`** at the end of every session with what was accomplished
4. **Update `MASTER.md` status table** whenever a feature moves from 🔲 to ✅
5. **Never assume** a feature is built — check the status table or look at the file
6. **Prefer editing existing files** over creating new ones unless clearly separate
7. **Keep docs lean** — update in place, don't create duplicate files
8. **Check `.env` for API keys** before writing any code that calls external APIs

---

## 🏗️ Coding Conventions

### General
- **Language**: JavaScript (Node.js backend, React frontend) — no TypeScript unless explicitly asked
- **Style**: CommonJS (`require/module.exports`) in `/server`, ESM (`import/export`) in `/src`
- **Error handling**: Always `try/catch` in async functions; log with `[ModuleName] Error:` prefix
- **Logging**: Use `console.log('[ModuleName] message')` format — e.g. `[DB]`, `[Gemini]`, `[Instagram]`

### Backend (`/server`)
- Each module has one responsibility — don't add Instagram logic to `gemini.js`
- Database calls only through `db.js` — no raw SQL elsewhere
- All env vars loaded via `dotenv` at top of `index.js` only; other modules import from process.env
- Never store raw access tokens to disk — in-memory only; only encrypted refresh tokens in DB

### Frontend (`/src`)
- API calls always go through `axios` with `SERVER = import.meta.env.VITE_SERVER_URL`
- State managed in `App.jsx` — no Redux, no Zustand (keep it simple)
- Styling in `index.css` only — no inline styles, no component-level CSS files

---

## 🔒 Security Rules

| Rule | Reason |
|------|--------|
| OAuth tokens stay in memory only | If server restarts, user re-authenticates |
| Refresh tokens are NOT stored (yet) | Simplicity for personal use; add encryption before any multi-user release |
| `.env` never committed | Already in `.gitignore` |
| Instagram access token in `.env` | Long-lived token from Graph API Explorer |
| No raw SQL with user input | Use parameterized queries via `better-sqlite3` prepared statements |

---

## 📐 Design Rules

- **Framework**: ShadCN component library (copy-paste, lives in `src/components/ui/`)
- **Styling**: Tailwind CSS v3 — utility classes only, no inline styles, no external CSS files
- **Theme**: Dark glassmorphism — dark navy (`#080e1a`), glass cards, purple gradient accents
- **Primary gradient**: `#833ab4 → #c13584 → #e879f9` (use `bg-brand-gradient` utility)
- **Font**: Inter (system stack: `'Inter', system-ui, -apple-system, sans-serif`)
- **Animations**: Subtle — Framer Motion spring for cards (`stiffness:300, damping:25`), CSS `animate-*` for micro-interactions
- **Glass card**: use `.glass-card` CSS utility class (defined in `index.css`)
- **Mobile responsive**: Tailwind grid with `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`
- **No placeholder images** — generate real images if UI images are needed
- **Toast**: `sonner` library — use `toast.success()`, `toast.error()`, `toast.loading()` + dismiss by ID

### Component Locations
| Component | File |
|-----------|------|
| Button, all variants | `src/components/ui/button.jsx` |
| Card, CardHeader, CardContent | `src/components/ui/card.jsx` |
| Badge (auto-maps queue status) | `src/components/ui/badge.jsx` |
| Tabs, TabsList, TabsTrigger | `src/components/ui/tabs.jsx` |
| Switch, Separator, Tooltip | `src/components/ui/primitives.jsx` |
| StatCard, EmptyState, SectionHeader, ServerStatusDot | `src/components/shared.jsx` |
| Helper: `cn()` class merger | `src/lib/utils.js` |

---

## 🚫 What We're NOT Doing

| Rejected | Reason |
|----------|--------|
| Supabase | OAuth tokens must stay local; SQLite is simpler and faster |
| TypeScript | Adds friction for rapid iteration |
| Redux / Zustand | Overkill for single-user app |
| Pexels for AI training | Their ToS bans it; use Pixabay CC0 instead |
| Veo 3 as primary generator | Too expensive ($0.50/sec); use Kling, Veo for hero only |
| photoslibrary.readonly scope | Deprecated March 31, 2025; Picker API only |
| Storing tokens in localStorage | XSS risk; in-memory only |

---

## 📦 Dependency Rules

- **Add to backend**: `cd server && npm install <package>`
- **Add to frontend**: `npm install <package>` from project root
- **Prefer well-maintained packages**: Check npm download count + last publish date
- **Avoid heavy packages** when native Node.js works (e.g., use `crypto.randomUUID()` not `uuid`)

---

## 🔄 Workflow Rules

### Starting a Coding Session
1. `cd server && node index.js` — start backend
2. `npm run dev` — start frontend (separate terminal)
3. Open `docs/BUILD_LOG.md` → read latest "Next Features" section
4. Check `.env` has all needed keys

### Finishing a Coding Session
1. Update `docs/BUILD_LOG.md` with a new session block
2. Update status table in `docs/MASTER.md`
3. Note any blockers or decisions made

### When Adding a New Feature
1. Check `MASTER.md` roadmap — is it in Phase 1, 2, or 3?
2. Check `API_REFERENCE.md` for relevant API specs
3. Check `TOOL_STACK.md` for chosen tool
4. Build → test → update status table

---

## 🎯 Product Rules (Non-Negotiable)

1. **Personal photos only (Phase 1)** — We work with the user's Google Photos, not stock footage
2. **Always human-in-the-loop for Phase 1** — AI scores and queues, human approves before posting
3. **Respect rate limits** — Never exceed Instagram's 100 posts/24h or 200 API calls/hr
4. **No NSFW content** — Use Gemini's built-in safety filters; never disable them
5. **Attribution**: If using Pixabay/stock assets, only CC0 licensed content for commercial use
6. **Content audit**: AI-generated captions must not contain factual claims that could be wrong (flag educational niches for human review)
