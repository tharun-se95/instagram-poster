/**
 * claudeService.js — Anthropic Claude vision provider
 *
 * Implements the same analyzePhoto / regenerateCaption interface as geminiService,
 * using the Anthropic Messages API with vision support (no SDK required).
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';
import { CURATION_PROMPT } from './curationPrompt.js';

const BASE_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

function getHeaders() {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
    return {
        'x-api-key':         key,
        'anthropic-version': API_VERSION,
        'Content-Type':      'application/json',
    };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function analyzePhoto(imageBuffer, mimeType = 'image/jpeg', model = 'claude-sonnet-4-6') {
    const base64Image = imageBuffer.toString('base64');

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const { data } = await axios.post(BASE_URL, {
                model,
                max_tokens: 1500,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type:   'image',
                                source: { type: 'base64', media_type: mimeType, data: base64Image },
                            },
                            { type: 'text', text: CURATION_PROMPT },
                        ],
                    },
                ],
            }, { headers: getHeaders() });

            const text  = data.content[0].text.trim();
            const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
            return JSON.parse(clean);

        } catch (err) {
            const status = err.response?.status;
            const is429  = status === 429 || err.message?.includes('429');

            if (is429 && attempt === 1) {
                logger.warn('[Claude] Rate limited on attempt 1 — waiting 12s before retry');
                await sleep(12000);
                continue;
            }

            const reason = is429 ? 'Anthropic rate limit (429) — try again later' : (err.response?.data?.error?.message || err.message);
            logger.error({ err: err.message, attempt, model }, '[Claude] Analysis failed — photo will be skipped');
            return { _apiError: true, rejection_reason: reason };
        }
    }
}

export async function regenerateCaption(subject, mood, niche = 'lifestyle', model = 'claude-sonnet-4-6') {
    try {
        const prompt = `Write an engaging Instagram caption for a ${mood} photo featuring ${subject}.
Style: ${niche} account. Include 2-3 sentences with emojis and a call-to-action.
Return ONLY the caption text, no JSON.`;

        const { data } = await axios.post(BASE_URL, {
            model,
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }],
        }, { headers: getHeaders() });

        return data.content[0].text.trim();
    } catch (err) {
        logger.error({ err: err.message, model }, '[Claude] Caption regeneration failed');
        return null;
    }
}
