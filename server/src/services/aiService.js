/**
 * aiService.js — Provider-agnostic AI router
 *
 * Reads `ai_provider` and `ai_model` from the settings DB and delegates
 * analyzePhoto() / regenerateCaption() to the appropriate provider service.
 *
 * Supported providers:  gemini | openai | anthropic
 */

import * as db from '../models/db.js';
import { logger } from '../utils/logger.js';

// ─── Provider registry ────────────────────────────────────────────────────────

export const PROVIDERS = {
    gemini: {
        label: 'Google Gemini',
        envKey: 'VITE_GEMINI_API_KEY',
        models: [
            { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (fast)' },
            { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro (best quality)' },
            { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (stable)' },
        ],
    },
    openai: {
        label: 'OpenAI',
        envKey: 'OPENAI_API_KEY',
        models: [
            { id: 'gpt-4o',      label: 'GPT-4o (best quality)' },
            { id: 'gpt-4o-mini', label: 'GPT-4o Mini (fast & cheap)' },
        ],
    },
    anthropic: {
        label: 'Anthropic Claude',
        envKey: 'ANTHROPIC_API_KEY',
        models: [
            { id: 'claude-opus-4-6',          label: 'Claude Opus 4.6 (most capable)' },
            { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 (balanced)' },
            { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fast & cheap)' },
        ],
    },
};

// ─── Lazy-loaded provider modules ─────────────────────────────────────────────

let _gemini   = null;
let _openai   = null;
let _anthropic = null;

async function getProviderModule(provider) {
    switch (provider) {
        case 'gemini':
            if (!_gemini)    _gemini    = await import('./geminiService.js');
            return _gemini;
        case 'openai':
            if (!_openai)    _openai    = await import('./openaiService.js');
            return _openai;
        case 'anthropic':
            if (!_anthropic) _anthropic = await import('./claudeService.js');
            return _anthropic;
        default:
            throw new Error(`Unknown AI provider: "${provider}"`);
    }
}

// ─── Public helpers ───────────────────────────────────────────────────────────

function getActiveProvider() {
    return db.getSetting('ai_provider') || 'gemini';
}

function getActiveModel() {
    return db.getSetting('ai_model') || 'gemini-2.5-flash';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse a photo buffer and return structured JSON curation data.
 * Delegates to whichever provider is configured in settings.
 */
export async function analyzePhoto(imageBuffer, mimeType = 'image/jpeg') {
    const provider = getActiveProvider();
    const model    = getActiveModel();
    logger.info({ provider, model }, '[AI] analyzePhoto — dispatching');
    const mod = await getProviderModule(provider);
    return mod.analyzePhoto(imageBuffer, mimeType, model);
}

/**
 * Regenerate an Instagram caption for the given subject/mood/niche.
 */
export async function regenerateCaption(subject, mood, niche = 'lifestyle') {
    const provider = getActiveProvider();
    const model    = getActiveModel();
    const mod = await getProviderModule(provider);
    return mod.regenerateCaption(subject, mood, niche, model);
}

/**
 * Return available providers/models + which one is currently active.
 * Used by the /ai/providers API endpoint.
 */
export function getProvidersInfo() {
    const activeProvider = getActiveProvider();
    const activeModel    = getActiveModel();
    return {
        active: { provider: activeProvider, model: activeModel },
        providers: Object.entries(PROVIDERS).map(([id, info]) => ({
            id,
            label:   info.label,
            envKey:  info.envKey,
            hasKey:  Boolean(process.env[info.envKey]),
            models:  info.models,
        })),
    };
}
