---
description: Master development cycle — the repeating loop every agent session must follow for InstaPoster Pro
---

# 🔄 InstaPoster Pro — Persistent Development Cycle

> **This is the single workflow agents follow to stay consistent across all sessions.**
> Agents work **continuously and autonomously** — no pausing for approval.
> At the start of a session, plan multiple phases ahead. Execute them all. The final phase of every session plans the next session's phases.

---

## 🏁 PHASE 0 — ORIENT (Run at start of EVERY session)

Read these files **before touching any code**. No exceptions.

```
docs/MASTER.md          → current feature status table + roadmap
docs/BUILD_LOG.md       → what was done last session + "Next Features" list
docs/RULES.md           → coding conventions, security rules, what NOT to do
architecture.md         → system diagram, file responsibilities, data flow
knowledge.md            → lessons learned, known bugs, open questions
.agents/rules/system-behavior.md   → planning + verification + safety policies
.agents/rules/coding-standards.md  → code style rules for this project
```

**Key questions to answer at the end of PHASE 0:**
- [ ] What is the current Phase? (1 / 2 / 3)
- [ ] What did the last session leave as "Next Features"?
- [ ] Are there open blockers in `knowledge.md`?
- [ ] Is the backend running? (`curl http://localhost:3001/api/health`)
- [ ] Is the Gemini API key set? (`grep GEMINI .env`)

---

## 📋 PHASE 1 — REVIEW

### 1.1 — Understand the Target Feature
Identify the next feature from `docs/BUILD_LOG.md` → "Next Features to Build".
Cross-reference against `docs/MASTER.md` roadmap phase to confirm priority.

### 1.2 — Check the API Contracts
Read `docs/API_REFERENCE.md` for any external API specs needed.
Read `docs/TOOL_STACK.md` to confirm which tool is chosen for this layer.

### 1.3 — Run the Audit
```bash
# Quick health check — run before starting any feature work
grep -rn --include="*.js" --include="*.jsx" \
  -E "(api_key|access_token)\s*=\s*['\"][^'\"]{8,}" \
  /Users/tharunk/Documents/instagram-poster/src \
  /Users/tharunk/Documents/instagram-poster/server \
  --exclude-dir=node_modules
```

Check for TODOs left from last session:
```bash
grep -rn "TODO\|FIXME\|BLOCKER" \
  /Users/tharunk/Documents/instagram-poster/src \
  /Users/tharunk/Documents/instagram-poster/server \
  --exclude-dir=node_modules
```

### 1.4 — Document Review Findings
Update `knowledge.md` → **Open Questions** section with anything unclear before building.

---

## 🗺️ PHASE 2 — PLAN

> ⚠️ **REQUIRED** per `system-behavior.md`: Generate a plan before writing any code.
> **You MUST present the `implementation_plan.md` and feature details to the user, and wait for their feedback/approval.**

### 2.1 — Plan Multiple Phases Ahead
Do not plan a single task. **Plan 3–5 implementation phases** in one pass:
- Read `docs/MASTER.md` roadmap and `docs/BUILD_LOG.md` next features
- Group related features into logical phases (e.g., Phase A: DB + API route; Phase B: UI; Phase C: scheduling)
- Write `implementation_plan.md` covering all planned phases with:
  - Phase name + goal
  - Files to create / modify / delete per phase
  - Data flow changes
  - New env vars (if any)
  - Dependencies between phases (which must finish before the next starts)

### 2.2 — Decompose into Task Checklist
Create / update `task.md` with all phases laid out:
```
## Phase A — [Name]
- [ ] Step 1
- [ ] Step 2

## Phase B — [Name]
- [ ] Step 1 (depends on Phase A)
```
Mark independent steps so they can be executed in parallel.

### 2.3 — Check Constraints Against `coding-standards.md`
Before writing:
- Module placement: `api/`, `server/`, `components/`, `src/components/ui/`
- Import style: ESM `import` everywhere (both `src/` and `server/`)
- DB changes go only through `server/db.js`
- UI: ShadCN components from `src/components/ui/`, Framer Motion for animations
- Styling: Tailwind utility classes + `.glass-card` — no inline styles

> 🛑 **STOP HERE.** Present the plan to the user and wait for explicit approval before moving to PHASE 3.

---

## 🔨 PHASE 3 — IMPLEMENT

Follow this order to minimize integration issues:

```
1. DB layer first  (server/db.js — schema + queries)
2. Server module   (server/<module>.js — business logic)
3. API route       (server/index.js — add route, thin handler)
4. Frontend API    (src/api/<module>.js — axios calls)
5. UI component    (src/components/ or src/App.jsx)
6. Styling         (src/index.css — add tokens/classes if needed)
```

### Implementation Rules (from `docs/RULES.md`)
- All async functions wrapped in `try/catch`
- Log every step: `console.log('[ModuleName] step description')`
- No hardcoded tokens — check `.env` first
- State lives in `App.jsx` only — no local state in child components for server data
- New env vars: add to `.env` AND document in `docs/MASTER.md` env table

### Mark Progress
Update `task.md` → mark items `[/]` when starting, `[x]` when done.

> ⚡ **Execute all planned phases before moving to PHASE 4.** Do not stop between phases.

---

## ✅ PHASE 4 — VERIFY

> ⚠️ **REQUIRED** per `system-behavior.md`: Never declare done without verification.

### 4.1 — Backend Verification (Terminal)
```bash
# Restart server with latest code
cd /Users/tharunk/Documents/instagram-poster/server && node index.js

# Test new API route
curl -X POST http://localhost:3001/api/<new-endpoint> \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### 4.2 — Frontend Verification (Browser Agent)
Use Browser Agent to:
1. Navigate to `http://localhost:5173`
2. Exercise the new feature end-to-end
3. Take a **screenshot** as proof of working state
4. Check browser console for errors

### 4.3 — Run ESLint
```bash
cd /Users/tharunk/Documents/instagram-poster && npm run lint 2>&1
```

### 4.4 — Check Standards Compliance
Review changed files against `.agents/rules/coding-standards.md`:
- [ ] No inline secrets
- [ ] All async functions have try/catch
- [ ] New UI components < 200 lines
- [ ] No inline API calls inside JSX components

---

## 📝 PHASE 5 — PERSIST + PLAN NEXT

> This phase closes the current cycle AND seeds the next one. It is what keeps agents consistent across sessions.

### 5.1 — Update `docs/BUILD_LOG.md`
Add a new `## Session N — [Date]` block:
```markdown
## Session N — [Date]

### Accomplished
- [Feature built]

### Files Created / Modified
- [list]

### Phases Completed This Session
- Phase A: [name] ✅
- Phase B: [name] ✅

### Next Phases (Pre-Planned)
- Phase C: [name] — [brief description] 🔲
- Phase D: [name] — [brief description] 🔲
- Phase E: [name] — [brief description] 🔲
```

### 5.2 — Update `docs/MASTER.md`
- Move features from 🔲 to ✅ in the status table
- Add/update env vars table if new vars introduced

### 5.3 — Update `knowledge.md`
If anything non-trivial was debugged or decided, add to **Lessons Learned**:
```markdown
### [Date] — [Short Title]
- Root cause: ...
- Fix: ...
- Key insight: ...
```

### 5.4 — Update `architecture.md`
If new files were created or data flow changed, update the relevant sections.

### 5.5 — 🔮 Plan Next 3–5 Phases (CRITICAL)
This is the most important step. Before ending the session, the agent must plan the **next 3–5 implementation phases** so the next agent thread has a full plan ready:

```markdown
## 🔮 Next Session Plan — [Date]

### Phase C — [Name]
- Goal: ...
- Files affected: ...
- Depends on: Phase B ✅

### Phase D — [Name]
- Goal: ...
- Files affected: ...
- Depends on: Phase C

### Phase E — [Name]
- Goal: ...
- Files affected: ...
- Can run in parallel with Phase D
```

Write this plan as a new block at the **bottom of `docs/BUILD_LOG.md`** so the next agent reads it during Phase 1 — Review.

### 5.6 — Generate Walkthrough Artifact
Create / update `walkthrough.md` documenting:
- What was built this session
- How it was tested (terminal output or screenshot)
- The pre-planned next phases (copy from 5.5)

---

## 🚦 CYCLE STATE MACHINE

```
   ┌────────────────────────────────────────────────────────────┐
   │                    SESSION START                           │
   └──────────────────────────┬─────────────────────────────────┘
                              ↓
                   ┌──────────────────┐
                   │  PHASE 0         │  Read 7 docs
                   │  ORIENT          │  Check server health
                   └────────┬─────────┘
                            ↓
                   ┌──────────────────┐
                   │  PHASE 1         │  Read BUILD_LOG
                   │  REVIEW          │  Run quick audit
                   └────────┬─────────┘
                            ↓
                   ┌──────────────────┐
                   │  PHASE 2         │  Plan 3–5 phases ahead
                   │  PLAN            │  Write task.md + plan
                   └────────┬─────────┘
                            ↓
         ┌──────────────────────────────────────┐
         │  PHASE 3 — IMPLEMENT (repeat N times) │
         │  Execute Phase A → B → C → ...        │
         │  DB → Server → Route → API → UI       │
         │  Update task.md [/] → [x] as you go   │
         └──────────────────┬───────────────────┘
                            ↓
                   ┌──────────────────┐
                   │  PHASE 4         │  Terminal test
                   │  VERIFY          │  Browser Agent + ESLint
                   └────────┬─────────┘
                            ↓
                   ┌──────────────────┐
                   │  PHASE 5         │  BUILD_LOG + MASTER
                   │  PERSIST         │  knowledge + architecture
                   │  + PLAN NEXT     │  ← Pre-plan next 3–5 phases
                   └────────┬─────────┘
                            ↓
         ┌──────────────────────────────────────┐
         │   Next agent reads BUILD_LOG Phase 1  │
         │   Finds pre-planned phases ready ✅   │
         │   Skips planning → goes to Phase 3   │
         └──────────────────────────────────────┘
                            ↓
                      LOOP FOREVER
```

---

## ⚡ Quick Reference — Phase Checklist

| Phase | Key Action | Output |
|-------|-----------|--------|
| 0 — Orient | Read 7 docs, check server | Current context loaded |
| 1 — Review | Read BUILD_LOG pre-planned phases | Confirmed execution order |
| 2 — Plan | Plan 3–5 phases in `implementation_plan.md` + `task.md` | Full autonomous plan |
| 3 — Implement | Execute ALL planned phases: DB → Server → Route → API → UI | All phases done ✅ |
| 4 — Verify | Terminal test + Browser Agent screenshot + ESLint | Proof of working state |
| 5 — Persist + Plan Next | BUILD_LOG + MASTER + knowledge + architecture + pre-plan next 3–5 phases | Next agent pre-loaded |

---

## 🔗 Key File Locations

| File | Path | Purpose |
|------|------|---------|
| Roadmap | `docs/MASTER.md` | Feature status + env vars |
| Session log | `docs/BUILD_LOG.md` | What to build next |
| Conventions | `docs/RULES.md` | Coding + design rules |
| APIs | `docs/API_REFERENCE.md` | External API specs |
| Tools | `docs/TOOL_STACK.md` | Which library for each layer |
| Architecture | `architecture.md` | System diagram + file map |
| Lessons | `knowledge.md` | Bugs fixed, decisions made |
| Behavior | `.agents/rules/system-behavior.md` | Planning + safety policies |
| Standards | `.agents/rules/coding-standards.md` | Code quality rules |
