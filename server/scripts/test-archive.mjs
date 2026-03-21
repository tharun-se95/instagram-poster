/**
 * test-archive.mjs
 * Standalone test: verifies the Instagram archive API call works
 * Run: node server/scripts/test-archive.mjs
 */
import axios from 'axios';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const ACCESS_TOKEN = process.env.VITE_INSTAGRAM_ACCESS_TOKEN;
const API_VERSION   = process.env.VITE_IG_API_VERSION || 'v25.0';
const BASE_URL      = `https://graph.instagram.com/${API_VERSION}`;

// Use the most recent real post ID from the DB
const TEST_POST_ID = process.argv[2] || '18093672767014668';

console.log('━━━ Instagram Archive API Test ━━━');
console.log(`Post ID  : ${TEST_POST_ID}`);
console.log(`Endpoint : POST ${BASE_URL}/${TEST_POST_ID}`);
console.log('');

// ── Test 1: Current implementation (with comment_enabled) ────────────────────
console.log('Test 1 — Current impl: archive=true + comment_enabled=true');
try {
    const res = await axios.post(`${BASE_URL}/${TEST_POST_ID}`, null, {
        params: { archive: 'true', comment_enabled: 'true', access_token: ACCESS_TOKEN },
    });
    console.log('  ✅ SUCCESS:', JSON.stringify(res.data));
} catch (err) {
    const igErr = err.response?.data?.error;
    console.log('  ❌ FAILED:', igErr ? JSON.stringify(igErr) : err.message);
}

console.log('');
await new Promise(r => setTimeout(r, 1500));

// ── Test 2: Clean implementation (archive only) ──────────────────────────────
console.log('Test 2 — Clean impl: archive=true only');
try {
    const res = await axios.post(`${BASE_URL}/${TEST_POST_ID}`, null, {
        params: { archive: 'true', access_token: ACCESS_TOKEN },
    });
    console.log('  ✅ SUCCESS:', JSON.stringify(res.data));
} catch (err) {
    const igErr = err.response?.data?.error;
    console.log('  ❌ FAILED:', igErr ? JSON.stringify(igErr) : err.message);
}

console.log('');
await new Promise(r => setTimeout(r, 1500));

// ── Test 3: Unarchive (restore — restore state for the real post) ────────────
console.log('Test 3 — Unarchive: archive=false (restores post)');
try {
    const res = await axios.post(`${BASE_URL}/${TEST_POST_ID}`, null, {
        params: { archive: 'false', access_token: ACCESS_TOKEN },
    });
    console.log('  ✅ SUCCESS:', JSON.stringify(res.data));
} catch (err) {
    const igErr = err.response?.data?.error;
    console.log('  ❌ FAILED:', igErr ? JSON.stringify(igErr) : err.message);
}

console.log('');
console.log('━━━ Test complete ━━━');
