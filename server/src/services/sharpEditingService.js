import sharp from 'sharp';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SHARP_EDITED_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'edited');

// Ensure the edited output directory exists
await fs.mkdir(SHARP_EDITED_DIR, { recursive: true }).catch(() => {});

// ─── Gemini text model (free tier) ────────────────────────────────────────────
let _model = null;
function getModel() {
    if (!_model) {
        const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);
        _model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }
    return _model;
}

/**
 * Parse prompt: ask Gemini text to translate editing suggestions into Sharp.js params.
 * Each suggestion is image-specific (came from Gemini vision analysis), so the text
 * model should have no trouble mapping them to numeric adjustments.
 */
const PARSE_PROMPT = `You are a photo editing parameter converter.
Convert the following photo editing instructions into Sharp.js adjustment parameters.
Return ONLY a valid JSON object — no markdown, no explanation, just JSON.

These values are ADDITIVE DELTAS applied as: Sharp_multiplier = 1 + value.
So: 0 = no change, 0.2 = 20% boost, -0.2 = 20% reduction.
CRITICAL: saturation of -1 = PURE BLACK AND WHITE. Never go below -0.25 for saturation.

Available fields (all optional, only include what the instructions call for):
{
  "brightness": <float -0.4 to 0.4 — 0=no change, 0.15=brighter, -0.12=darker>,
  "contrast":   <float -0.4 to 0.4 — 0=no change, 0.15=more contrast, -0.12=softer>,
  "saturation": <float -0.25 to 0.5 — 0=KEEP COLORS UNCHANGED, 0.2=mild boost, 0.4=strong boost, -0.1=gentle muting. NEVER below -0.25. Most photos use 0 or positive.>,
  "hue":        <int -30 to 30 — rotate color wheel in degrees, 0=unchanged>,
  "warmth":     <int -30 to 30 — 0=neutral, 12=warm/golden, -12=cool/blue>,
  "sharpen":    <float 0 to 2.5 — sigma for unsharp mask; 0=skip, 0.8=mild, 1.5=strong>,
  "denoise":    <boolean — true applies gentle median noise reduction>,
  "clahe":      <boolean — true applies adaptive contrast (CLAHE) to recover shadow/highlight detail>
}

Mapping hints:
- "boost vibrance / saturation / greens / blues pop" → saturation: 0.2–0.4
- "recover highlights / overexposed sky / blown-out areas" → brightness: -0.1 to -0.2, clahe: true
- "lift shadows / fill light / underexposed" → brightness: 0.1–0.2, clahe: true
- "increase contrast / punch / pop" → contrast: 0.1–0.25
- "soften / reduce harsh contrast" → contrast: -0.1 to -0.2
- "sharpen / add clarity / crispness" → sharpen: 0.8–1.5
- "reduce noise / smooth grain" → denoise: true
- "warm up / golden tones / sunset warmth" → warmth: 10–20
- "cool down / blue tones / cooler feel" → warmth: -10 to -20
- "EV +X" → brightness: X * 0.15 (e.g. +0.7 EV → brightness: 0.1)
- "EV -X" → brightness: X * -0.15
- "muted / film look / desaturate slightly" → saturation: -0.1 to -0.2 (MAXIMUM negative: -0.25)

Photo editing instructions:
`;

/**
 * Keyword-based fallback parser — no API calls required.
 * Scans each suggestion for known editing terms and accumulates params.
 * Covers ~90% of the suggestions Gemini vision typically generates.
 */
function parseWithKeywords(suggestions) {
    const params = {};
    const acc = (key, val) => { params[key] = (params[key] || 0) + val; };

    for (const s of suggestions) {
        const t = s.toLowerCase();

        // ── Brightness / exposure ────────────────────────────────────────────
        if (/brighten|lift shadow|fill light|underexpos|lift dark|open up shadow/.test(t)) acc('brightness', 0.12);
        if (/darken|reduce bright|tone down|overexpos|recover highlight|blown.?out/.test(t)) acc('brightness', -0.12);
        const evMatch = t.match(/([+-]?\d+\.?\d*)\s*ev/);
        if (evMatch) acc('brightness', parseFloat(evMatch[1]) * 0.13);

        // ── Contrast ────────────────────────────────────────────────────────
        if (/boost contrast|add contrast|increase contrast|punch|pop|increase depth/.test(t)) acc('contrast', 0.15);
        if (/reduce contrast|soften|flatten|lower contrast/.test(t)) acc('contrast', -0.12);

        // ── Saturation / vibrance ────────────────────────────────────────────
        if (/vibrance|saturat|vivid|color.*pop|pop.*color|green.*blue|boost color/.test(t)) acc('saturation', 0.22);
        if (/desatur|muted|tone.*down.*color|reduce color/.test(t)) acc('saturation', -0.15);

        // ── Warmth / color temperature ───────────────────────────────────────
        if (/warm|golden|amber|sunset tone|orange cast/.test(t)) acc('warmth', 12);
        if (/cool|blue tone|neutralize warm|white balance.*cool/.test(t)) acc('warmth', -12);
        // Neutral white balance nudge — small correction
        if (/white balance|neutralize cast|color cast/.test(t)) {
            // If no other warmth clue, apply a mild cooling to counteract typical warm casts
            if (!params.warmth) acc('warmth', -6);
        }

        // ── Hue ─────────────────────────────────────────────────────────────
        // (rarely needed, skip for keyword parser)

        // ── Sharpening / clarity ─────────────────────────────────────────────
        if (/sharp|clarify|clarity|crisp|fine detail|texture detail|definition/.test(t)) {
            params.sharpen = Math.min((params.sharpen || 0) + 0.8, 2.0);
        }

        // ── Noise / grain ────────────────────────────────────────────────────
        if (/noise|grain|smooth|denoise/.test(t)) params.denoise = true;

        // ── CLAHE — shadow/highlight detail recovery ─────────────────────────
        if (/recover|reveal detail|shadow detail|highlight detail|dynamic range|lift shadow/.test(t)) {
            params.clahe = true;
        }
    }

    // Clamp accumulated values to safe ranges
    if (params.brightness != null) params.brightness = Math.max(-0.4, Math.min(0.4, params.brightness));
    if (params.contrast   != null) params.contrast   = Math.max(-0.4, Math.min(0.4, params.contrast));
    if (params.saturation != null) params.saturation = Math.max(-0.25, Math.min(0.5, params.saturation));
    if (params.warmth     != null) params.warmth     = Math.max(-30,  Math.min(30,  params.warmth));

    // If nothing was detected at all, use mild safe defaults
    if (Object.keys(params).length === 0) {
        return { brightness: 0.05, contrast: 0.1, saturation: 0.15, sharpen: 0.8 };
    }

    logger.info({ params, suggestionCount: suggestions.length }, '[SharpEdit] Keyword-parsed editing params');
    return params;
}

/**
 * Use Gemini text model to parse an array of editing suggestions into Sharp params.
 * Falls back to keyword-based parsing, then mild defaults if both fail.
 */
async function parseWithGemini(suggestions) {
    const instructions = suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');

    try {
        const result = await getModel().generateContent(PARSE_PROMPT + instructions);
        const text = result.response.text().trim();
        // Strip markdown code fences if present
        const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        const params = JSON.parse(clean);
        logger.info({ params, suggestionCount: suggestions.length }, '[SharpEdit] Gemini parsed editing params');
        return params;
    } catch (err) {
        // Gemini unavailable (quota exhausted, network issue, etc.) — fall back to keyword parser
        logger.warn({ err: err.message }, '[SharpEdit] Gemini parse failed — falling back to keyword parser');
        return parseWithKeywords(suggestions);
    }
}

/**
 * Apply Sharp editing parameters to an image buffer.
 * Returns an edited JPEG buffer.
 */
async function applySharpParams(imageBuffer, params) {
    logger.info({ params }, '[SharpEdit] Applying Sharp parameters to image');

    let pipeline = sharp(imageBuffer);

    // ── 1. Modulate: brightness, saturation, hue ────────────────────────────
    // Sharp's .modulate() uses multipliers: brightness=1 means no change.
    const modulateOpts = {};
    if (params.brightness != null && params.brightness !== 0) {
        // Clamp to avoid negative multiplier (Sharp throws on brightness < 0)
        modulateOpts.brightness = Math.max(0.1, 1 + params.brightness);
    }
    if (params.saturation != null && params.saturation !== 0) {
        // Floor at 0.4 — prevents AI from accidentally producing near-grayscale/B&W images.
        // Even if Gemini returns saturation: -0.8 (shouldn't happen), output stays 40% saturated (still colored).
        modulateOpts.saturation = Math.max(0.4, 1 + params.saturation);
    }
    if (params.hue != null && params.hue !== 0) {
        modulateOpts.hue = params.hue;
    }
    if (Object.keys(modulateOpts).length > 0) {
        pipeline = pipeline.modulate(modulateOpts);
    }

    // ── 2. Contrast via linear transform ────────────────────────────────────
    // output = a * input + b   (input in 0-255 space)
    // a > 1 boosts contrast; b shifts midtones back toward 128 to avoid blowout
    if (params.contrast != null && params.contrast !== 0) {
        const a = 1 + Math.max(-0.5, Math.min(0.5, params.contrast)); // clamp
        const b = Math.round(-128 * params.contrast); // keep midtones stable
        pipeline = pipeline.linear(a, b);
    }

    // ── 3. Warmth via tint ──────────────────────────────────────────────────
    // Sharp's .tint() blends each channel toward the given value.
    // Warm: slight amber cast (higher R, lower B); Cool: slight blue cast
    if (params.warmth != null && params.warmth !== 0) {
        const w = Math.max(-30, Math.min(30, params.warmth));
        if (w > 0) {
            // Warm tint: boost red channel slightly, reduce blue
            pipeline = pipeline.tint({
                r: 255,
                g: Math.round(255 - w * 0.4),
                b: Math.round(255 - w * 1.2),
            });
        } else {
            // Cool tint: boost blue, reduce red
            const cw = Math.abs(w);
            pipeline = pipeline.tint({
                r: Math.round(255 - cw * 1.2),
                g: Math.round(255 - cw * 0.4),
                b: 255,
            });
        }
    }

    // ── 4. CLAHE — adaptive contrast for detail recovery ────────────────────
    // Excellent for recovering detail in shadows or blown highlights.
    if (params.clahe) {
        pipeline = pipeline.clahe({ width: 64, height: 64, maxSlope: 3 });
    }

    // ── 5. Sharpening ───────────────────────────────────────────────────────
    // Always apply at least a light sharpen — Instagram's compression pipeline
    // reduces fine detail regardless of source quality.
    const sharpenSigma = (params.sharpen != null && params.sharpen > 0)
        ? Math.max(0.1, Math.min(3, params.sharpen))
        : 0.6; // mandatory minimum to counteract Instagram JPEG compression
    pipeline = pipeline.sharpen({ sigma: sharpenSigma, m1: 1.5, m2: 0.7 });

    // ── 6. Noise reduction ──────────────────────────────────────────────────
    // Median filter with radius 3 is gentle and effective for moderate grain
    if (params.denoise) {
        pipeline = pipeline.median(3);
    }

    // Output as high-quality JPEG — 88 is the sweet spot for Instagram (80-90% range)
    return pipeline.jpeg({ quality: 88 }).toBuffer();
}

/**
 * Resolve the Sharp params to use, in priority order:
 *   1. preComputedParams — from Gemini vision (stored in DB at analysis time, most accurate)
 *   2. parseWithGemini(suggestions) — Gemini text call to parse natural-language suggestions
 *   3. parseWithKeywords(suggestions) — zero-API keyword parser (quota-safe fallback)
 *
 * @param {string[]} suggestions - Natural-language editing suggestions
 * @param {object|null} preComputedParams - Sharp params already computed by Gemini vision
 */
async function resolveParams(suggestions, preComputedParams) {
    // Priority 1: Gemini vision already gave us machine-readable params — use directly
    if (preComputedParams && typeof preComputedParams === 'object' && Object.keys(preComputedParams).length > 0) {
        logger.info({ params: preComputedParams }, '[SharpEdit] Using Gemini vision pre-computed Sharp params');
        return preComputedParams;
    }

    // Priority 2 & 3: parse from natural-language suggestions (with keyword fallback inside)
    if (suggestions && suggestions.length > 0) {
        return parseWithGemini(suggestions);
    }

    // Nothing to work with — mild safe defaults
    logger.warn('[SharpEdit] No params and no suggestions — applying mild defaults');
    return { brightness: 0.05, contrast: 0.1, saturation: 0.15, sharpen: 0.8 };
}

/**
 * Apply Sharp editing to an image buffer.
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {string[]} suggestions - Natural-language suggestions (fallback if no preComputedParams)
 * @param {object|null} preComputedParams - Sharp params from Gemini vision (preferred)
 * @returns {Promise<Buffer>} - Edited JPEG buffer
 */
export async function applySharpEditing(imageBuffer, suggestions, preComputedParams = null) {
    const params = await resolveParams(suggestions, preComputedParams);
    return applySharpParams(imageBuffer, params);
}

/**
 * Edit an image with Sharp and save to uploads/edited/{itemId}.jpg
 * @param {string} itemId
 * @param {Buffer} imageBuffer
 * @param {string[]} suggestions - Natural-language suggestions (fallback)
 * @param {object|null} sharpParams - Pre-computed params from Gemini vision (preferred)
 * Returns { buffer, path } on success.
 */
export async function sharpEditAndSave(itemId, imageBuffer, suggestions, sharpParams = null) {
    const editedBuffer = await applySharpEditing(imageBuffer, suggestions, sharpParams);
    const outputPath = path.join(SHARP_EDITED_DIR, `${itemId}.jpg`);
    await fs.writeFile(outputPath, editedBuffer);
    logger.info({ id: itemId, bytes: editedBuffer.length, path: outputPath }, '[SharpEdit] ✅ Saved edited image');
    return { buffer: editedBuffer, path: outputPath };
}
