---
description: Audit staged changes against coding standards and generate improvement summary
---

# Review Workflow

## Trigger
Run `/review` to audit current staged changes.

## Steps

1. **Show current git diff (staged changes)**
```bash
cd /Users/tharunk/Documents/instagram-poster && git diff --staged
```

2. **Show unstaged changes as well**
```bash
cd /Users/tharunk/Documents/instagram-poster && git diff
```

3. **Check staged files against `@coding-standards.md`**:
   - Read `.agents/rules/coding-standards.md`
   - For each changed file, evaluate it against the relevant standards:
     - **Frontend files** (`.jsx`): component size, no inline API calls, Radix UI usage, Framer Motion for animations
     - **Backend files** (`.js` in `server/`): async/await with try/catch, parameterized SQL, thin route handlers
     - **All files**: no hardcoded secrets, meaningful variable names, error handling

4. **Run ESLint on changed frontend files**
```bash
cd /Users/tharunk/Documents/instagram-poster && npm run lint 2>&1
```

5. **Generate a Review Summary artifact** (`review_summary.md`) containing:

   ### ✅ Compliant Items
   List of things that follow our standards.

   ### ⚠️ Warnings
   Non-blocking improvements (style, naming, etc.).

   ### 🚨 Issues (Must Fix)
   Blocking problems: security risks, unhandled errors, hardcoded secrets.

   ### 💡 Suggestions
   Optional improvements beyond the standards baseline.

   ### Overall Score
   `X / 10` compliance rating with brief justification.
