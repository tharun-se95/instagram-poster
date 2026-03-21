# InstaPoster Pro - Claude Code Configuration

This file configures Claude Code to operate optimally in the InstaPoster Pro workspace.

## 🚀 Agent & Subagent Architecture (CRITICAL)
To complete tasks faster and more efficiently, you MUST heavily utilize agents and subagents:
1. **Aggressive Task Decomposition**: Break down every complex feature request into smaller, isolated, and parallelizable sub-tasks (e.g., Database schema updates, Backend API routing, React Frontend UI).
2. **Spawn Parallel Subagents**: Whenever tasks do not have strict sequential dependencies, spawn subagents to work on them concurrently. For example, dispatch one subagent to wire up the API tests while another subagent builds the frontend UI components.
3. **Delegation**: Do not attempt to write all the code in a single monolithic pass. Delegate specific files and domain logic (like media bridging, Instagram API integration, or SQLite queries) to highly focused subagents.
4. **Subagent Orchestration**: Your primary role is to orchestrate these subagents, review their work, ensure they follow the project coding standards, and assemble the final feature.

## 🧠 Feature-Driven Workflow
You must follow a rigorous, feature-driven development cycle:
1. **Plan FIRST**: Read `docs/MASTER.md` and `docs/BUILD_LOG.md`, then generate an `implementation_plan.md` outlining the feature and its phases.
2. **Mandatory Discussion**: You MUST present the plan to the user and **wait for explicit approval** before writing any code. Do NOT execute autonomously without confirmation.
3. **Rigorous Testing**: Before finalizing a feature, verify it natively using terminal commands (backend) and browser interactions (frontend). Ensure subagents write tests for their respective tasks.
4. **Pre-plan Next Steps**: At the end of every session, update `docs/BUILD_LOG.md` with accomplishments and proactively plan the next 3-5 phases.
5. **Refer to Workflows**: Strictly adhere to the `.agents/workflows/dev-cycle.md` rules.

## 🏗️ Coding Conventions
- **Language**: JavaScript (Node.js backend, React frontend). No TypeScript unless explicitly asked.
- **Backend (`/server`)**: CommonJS (`require/module.exports`). Each module has one responsibility. Database calls go exclusively through the designated database handler (e.g. `server/src/models/db.js`). Error handling: always wrap async functions in `try/catch` and log with `[ModuleName] Error:`.
- **Frontend (`/src`)**: React + Vite using ESM (`import/export`). State is managed locally or via Context (no Redux). API calls via `axios` pointing to `import.meta.env.VITE_SERVER_URL`.
- **Styling**: Tailwind CSS v3 utility classes + ShadCN components (`src/components/ui/`). The theme leans toward dark glassmorphism (`.glass-card`).

## 🔒 Security & Environment
- **Never commit `.env`**.
- **No raw SQL**: Always use parameterized queries (`better-sqlite3`).
- **Token Security**: Keep OAuth access tokens in-memory only.

## 🔄 Common Commands
- **Start Backend**: `cd server && node index.js` (or use the package.json scripts)
- **Start Frontend**: `npm run dev`
- **Lint Code**: `npm run lint`
