---
description: Deploy the instagram-poster application (frontend build + server start)
---

# Deploy Workflow

// turbo-all

## Steps

1. **Install frontend dependencies**
```bash
cd /Users/tharunk/Documents/instagram-poster && npm install
```

2. **Install server dependencies**
```bash
cd /Users/tharunk/Documents/instagram-poster/server && npm install
```

3. **Build the frontend**
```bash
cd /Users/tharunk/Documents/instagram-poster && npm run build
```

4. **Verify the build output exists**
```bash
ls /Users/tharunk/Documents/instagram-poster/dist
```

5. **Start the backend server** (in a new terminal or background)
```bash
cd /Users/tharunk/Documents/instagram-poster/server && node index.js
```

6. **Start the frontend dev server** (for local review before deploying)
```bash
cd /Users/tharunk/Documents/instagram-poster && npm run dev
```

7. **Open the browser agent** to validate the UI loads correctly at `http://localhost:5173` and the backend health check responds at `http://localhost:3001/api/health`.

8. **Generate a Verification Walkthrough** (`walkthrough.md`) documenting:
   - Build output size
   - Screenshot of working dashboard
   - Any errors encountered and resolved
