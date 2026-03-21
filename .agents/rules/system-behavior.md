# System Behavior Rules
> Persistent constraints for the Antigravity agent in this workspace.
> Last updated: 2026-03-12

---

## 🗓️ Planning Policy

- **Always** generate an `implementation_plan.md` and `task.md` artifact **before modifying any code**.
- **Plan 3–5 phases ahead** in a single pass — group features into logical, dependent phases rather than planning one task at a time.
- **Always discuss feature plans with the user and wait for explicit approval before proceeding to the IMPLEMENT phase.**
- At the **end of every session**, pre-plan the next 3–5 phases in `docs/BUILD_LOG.md` so the next agent picks up instantly.
- Decompose large tasks into independent modules and track them in `task.md` using `[ ]` / `[/]` / `[x]` notation.


---

## ✅ Verification Policy

- Before declaring any task complete, **verify it** using:
  - **Browser Agent** — for all UI/frontend changes (screenshot or recording required).
  - **Terminal** — for backend logic, API responses, database state.
- Generate a **Verification Walkthrough artifact** (`walkthrough.md`) documenting:
  - What was changed
  - How it was tested
  - Validation results with embedded screenshots or terminal output

---

## 🛡️ Safety Policy

- **Never** execute `rm -rf` without showing the exact command to the user and waiting for **explicit manual approval** via the terminal prompt.
- **Never** run database migrations (schema changes, DROP TABLE, ALTER TABLE) without explicit user approval.
- **Never** commit or push to a remote repository without user confirmation.
- If a command could be destructive, set `SafeToAutoRun: false` and present it for user review.

---

## ⚡ Parallelization Protocol

- If a task has **independent modules** (e.g., frontend component + backend route + DB migration), suggest spawning a secondary agent via the **Agent Manager** to handle them in parallel.
- Clearly label which sub-tasks are independent and which are sequential dependencies.

---

## 🤖 Model Selection

| Task Type | Preferred Model |
|-----------|----------------|
| Architectural planning, system design | Gemini 3 Pro |
| Precise logic refactoring, bug fixes | Gemini 3 Flash |
| Code review, documentation | Gemini 3 Flash |

---

## 🔌 MCP Integration

All MCP servers are configured and available. Do not ask the user to install them.

| Server | Purpose | Scope | Config |
|--------|---------|-------|--------|
| **StitchMCP** | UI design & rapid prototyping | Global | `~/.gemini/antigravity/mcp_config.json` |
| **github-mcp-server** | Git ops, PR management, repo context | Global | `~/.gemini/antigravity/mcp_config.json` |
| **filesystem** | Read/write project files (scoped to project) | Project | `.gemini/settings.json` |
| **sqlite** | Direct SQL queries on `instaposter.db` | Project | `.gemini/settings.json` |
| **fetch** | HTTP calls for API testing (Instagram, Gemini, etc.) | Project | `.gemini/settings.json` |
| **playwright** | Browser automation for UI verification | Project | `.gemini/settings.json` |

### When to Use Each MCP

| Task | Use This MCP |
|------|-------------|
| Query the queue / check DB state | `sqlite` |
| Test a new API endpoint | `fetch` |
| Verify UI in browser | `playwright` |
| Read/write any project file | `filesystem` |
| Design a new UI screen | `StitchMCP` |
| Create a GitHub issue or PR | `github-mcp-server` |

