# Coding Standards
> Project-specific coding standards for `instagram-poster`.
> Last updated: 2026-03-12

---

## 🏗️ General Principles

- **Clarity over cleverness** — write code that a new contributor can understand in 30 seconds.
- **Single Responsibility** — each file / function should do one thing well.
- **No silent failures** — always propagate or log errors, never swallow them.

---

## ⚛️ Frontend (React / Vite)

- Use **functional components** with hooks only. No class components.
- Component files: `PascalCase.jsx` (e.g., `PhotoPicker.jsx`).
- Keep components under **200 lines**; extract sub-components if needed.
- Styling: **TailwindCSS utility classes** are the existing standard — continue using them.
- Use **Radix UI primitives** for accessible interactive elements (already a dependency).
- Animations: use **Framer Motion** for transitions and micro-animations.
- Toast notifications: use **Sonner** (already a dependency).
- API calls go in `src/api/` — never inline `fetch`/`axios` calls inside components.
- Use meaningful variable names; avoid single-letter vars except in tight loops.

---

## 🖥️ Backend (Node.js / Express)

- All server files live in `server/`.
- Use **ES Modules** (`import`/`export`) consistently — `"type": "module"` is set.
- Route handlers are thin — delegate business logic to dedicated modules:
  - `db.js` — all SQLite operations
  - `gemini.js` — all Gemini AI calls
  - `instagram.js` — all Instagram Graph API calls
  - `mediaBridge.js` — public URL bridging
  - `automation.js` — cron scheduling + curation loop
- Always use **async/await** with try/catch; never mix callbacks and promises.
- Log meaningful messages at each step using `console.log('[module] message')`.
- Validate all incoming request bodies before processing.

---

## 🗄️ Database (SQLite via `better-sqlite3`)

- Schema changes must be **additive** (new columns/tables only, no drops without approval).
- Always use **parameterized queries** — never string-interpolate SQL.
- Keep all DB operations in `server/db.js`.

---

## 🔐 Environment Variables

- All secrets in `.env` — never hard-code tokens or API keys.
- Frontend env vars must be prefixed with `VITE_`.
- Add any new env vars to the table in `docs/MASTER.md` and `architecture.md`.

---

## 📝 Documentation

- Update `docs/BUILD_LOG.md` at the end of every session with what was built/changed.
- Update `docs/MASTER.md` current status table when a feature goes from 🔲 to ✅.
- Update `knowledge.md` with Lessons Learned after any non-trivial debugging session.

---

## 🔍 Code Review Checklist (`/review`)

Before merging any changes, verify:
- [ ] No hard-coded credentials or tokens
- [ ] Error handling present for all async operations
- [ ] New API routes have input validation
- [ ] UI changes verified with Browser Agent screenshot
- [ ] `BUILD_LOG.md` updated with change summary
- [ ] `knowledge.md` updated if a lesson was learned
