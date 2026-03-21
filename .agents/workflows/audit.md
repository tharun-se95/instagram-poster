---
description: Audit the codebase for quality, security, and standards compliance
---

# Audit Workflow

## Trigger
Run `/audit` to perform a full codebase audit.

## Steps

1. **Check for hardcoded secrets**
```bash
grep -rn --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" \
  -E "(api_key|apikey|access_token|secret|password)\s*=\s*['\"][^'\"]{8,}" \
  /Users/tharunk/Documents/instagram-poster/src \
  /Users/tharunk/Documents/instagram-poster/server \
  --exclude-dir=node_modules
```

2. **Check for unhandled promise rejections (missing try/catch)**
```bash
grep -rn --include="*.js" --include="*.jsx" "await " \
  /Users/tharunk/Documents/instagram-poster/server \
  --exclude-dir=node_modules | grep -v "try\|catch\|\.catch"
```

3. **Run ESLint on the frontend**
```bash
cd /Users/tharunk/Documents/instagram-poster && npm run lint 2>&1
```

4. **Check for TODO/FIXME/HACK comments**
```bash
grep -rn --include="*.js" --include="*.jsx" "TODO\|FIXME\|HACK\|XXX" \
  /Users/tharunk/Documents/instagram-poster/src \
  /Users/tharunk/Documents/instagram-poster/server \
  --exclude-dir=node_modules
```

5. **Check environment variable completeness**
   - Read `.env` and compare against the variables documented in `docs/MASTER.md`.
   - Flag any variables that are set to placeholder values.

6. **Check database schema** against `server/db.js` to ensure:
   - All tables are properly indexed
   - No raw SQL string interpolation (should use parameterized queries)

7. **Review against `@coding-standards.md`**
   - Components over 200 lines?
   - Inline API calls (axios/fetch) inside components?
   - Class components instead of functional?

8. **Generate Audit Report artifact** (`audit_report.md`) with:
   - Summary of findings (Critical / Warning / Info)
   - File locations and line numbers for each issue
   - Recommended fixes
   - Compliance score vs `coding-standards.md`
