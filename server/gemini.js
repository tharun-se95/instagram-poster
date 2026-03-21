const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' });

const CURATION_PROMPT = `You are an expert Instagram content curator for lifestyle and travel accounts.
Analyze this photograph and return ONLY a valid JSON object with no markdown wrapping:
{
  "aesthetic_score": <integer 1-10>,
  "composition": "<one concise sentence>",
  "subject": "<primary subject keyword, e.g. sunset, street, portrait>",
  "mood": "<one of: travel|lifestyle|nature|urban|food|portrait|abstract>",
  "instagram_ready": <true|false>,
  "rejection_reason": "<empty string if ready, brief reason if not>",
  "suggested_caption": "<2-3 sentences with relevant emojis, end with a CTA like 'Save this for later ✨' or 'Share with someone who needs to see this'>",
  "hashtags": ["#tag1", "#tag2", "...up to 20 highly relevant hashtags"],
  "crop_recommendation": "<one of: '4:5 portrait'|'1:1 square'|'use as-is'>"
}

Scoring guide:
- 9-10: Stunning composition, great lighting, highly shareable
- 7-8: Good quality, Instagram-appropriate
- 5-6: Average, might work with the right caption
- 1-4: Poor lighting, blurry, cluttered, or not visually appealing

Reject if: blurry, severely underexposed/overexposed, cluttered composition,
NSFW, personally identifiable (close-up of strangers' faces without context),
or screenshots/document photos.`;

/**
 * Analyzes a photo buffer/base64 using Gemini Vision.
 * @param {Buffer} imageBuffer - The image data as a Buffer.
 * @param {string} mimeType - e.g. 'image/jpeg'
 * @returns {Promise<Object>} - Parsed JSON analysis from Gemini.
 */
async function analyzePhoto(imageBuffer, mimeType = 'image/jpeg') {
    try {
        const base64Image = imageBuffer.toString('base64');

        const result = await model.generateContent([
            CURATION_PROMPT,
            {
                inlineData: {
                    mimeType,
                    data: base64Image,
                },
            },
        ]);

        const text = result.response.text().trim();

        // Strip markdown code fences if model wraps response
        const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(clean);

        return parsed;
    } catch (err) {
        console.error('[Gemini] Analysis failed:', err.message);
        // Return a safe fallback so the pipeline doesn't crash
        return {
            aesthetic_score: 0,
            composition: 'Analysis failed',
            subject: 'unknown',
            mood: 'lifestyle',
            instagram_ready: false,
            rejection_reason: `Gemini error: ${err.message}`,
            suggested_caption: '',
            hashtags: [],
            crop_recommendation: 'use as-is',
        };
    }
}

/**
 * Generates a fresh caption for an already-analyzed photo.
 * Useful when user wants a different caption from the dashboard.
 */
async function regenerateCaption(subject, mood, niche = 'lifestyle') {
    try {
        const prompt = `Write an engaging Instagram caption for a ${mood} photo featuring ${subject}.
Style: ${niche} account. Include 2-3 sentences with emojis and a call-to-action.
Return ONLY the caption text, no JSON.`;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (err) {
        console.error('[Gemini] Caption regeneration failed:', err.message);
        return null;
    }
}

module.exports = { analyzePhoto, regenerateCaption };
