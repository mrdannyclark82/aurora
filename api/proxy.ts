/**
 * Vercel Serverless Function: POST /api/proxy
 *
 * Single backend entry point for the Aura frontend.
 *   - services/geminiService.ts    -> { service: 'gemini', action, ...params }
 *   - services/googleApiService.ts -> { service: 'google', action, ...params }
 *                                     + Authorization: Bearer <Google OAuth access token>
 *
 * Params are top-level fields of the JSON body (not nested under `params`).
 * Errors are always JSON: { error: <machine code>, message: <human text> }.
 *
 * Env vars (server-side only, never exposed to the browser):
 *   GEMINI_API_KEY   (required for service 'gemini')
 *   ALLOWED_ORIGINS  (optional, comma-separated extra origins allowed to call this endpoint)
 *   VERCEL_URL       (set by Vercel; the deployment's own host is always allowed)
 *
 * Origin check: every request must carry an Origin (or Referer) from an allowed site,
 * otherwise it is rejected with 403 { error: 'forbidden-origin' }.
 */
import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import type { Content, GenerateContentResponse, Part, Tool } from '@google/genai';

// ---------------------------------------------------------------------------
// Minimal request/response typings (compatible with Vercel's Node runtime)
// ---------------------------------------------------------------------------

interface ProxyRequest {
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    body?: unknown;
}

interface ProxyResponse {
    statusCode: number;
    headersSent: boolean;
    setHeader(name: string, value: string): void;
    status(code: number): ProxyResponse;
    json(body: unknown): void;
    send(body: unknown): void;
    write(chunk: string | Uint8Array): boolean;
    end(chunk?: string | Uint8Array): void;
}

type Body = Record<string, any>;

class HttpError extends Error {
    constructor(public status: number, public code: string, message: string) {
        super(message);
    }
}

const MODELS = {
    text: 'gemini-2.5-flash',
    pro: 'gemini-2.5-pro',
    image: 'imagen-4.0-generate-001',
    tts: 'gemini-2.5-flash-preview-tts',
    video: 'veo-3.1-fast-generate-preview',
};

const GEMINI_ACTIONS = [
    'generateText', 'getYoutubeTranscript', 'generateSearch', 'generateMaps', 'analyzeVideo',
    'generateImage', 'generateSpeech', 'generateVideo', 'getVideosOperation', 'fetchVideo',
    'generateChatStream', 'generateChat', 'generateWithTools', 'runAgent', 'proposeUpdate',
] as const;

const GOOGLE_ACTIONS = [
    'fetchUnreadGmail', 'fetchCalendarEvents', 'createCalendarEvent',
    'searchDriveFiles', 'getDriveFileContent', 'fetchYouTubeLikedVideos',
] as const;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default async function handler(req: ProxyRequest, res: ProxyResponse) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    try {
        const origin = requestOrigin(req);
        if (!origin || !isAllowedOrigin(origin)) {
            throw new HttpError(403, 'forbidden-origin', origin
                ? `Origin ${origin} is not allowed to call /api/proxy.`
                : 'Requests to /api/proxy must include an Origin or Referer header from an allowed site.');
        }
        res.setHeader('Access-Control-Allow-Origin', origin);

        if (req.method === 'OPTIONS') {
            // CORS preflight from an allowed origin.
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Max-Age', '600');
            res.status(204);
            return res.end();
        }

        if (req.method !== 'POST') {
            res.setHeader('Allow', 'POST');
            throw new HttpError(405, 'method-not-allowed', 'Only POST is supported on /api/proxy.');
        }

        const body = parseBody(req.body);
        const service = body.service;
        const action = body.action;
        if (typeof service !== 'string' || typeof action !== 'string') {
            throw new HttpError(400, 'bad-request', 'Request body must include string fields "service" and "action".');
        }

        if (service === 'gemini') {
            if (!(GEMINI_ACTIONS as readonly string[]).includes(action)) {
                throw new HttpError(400, 'unknown-action', `Unknown gemini action: ${action}`);
            }
            return await handleGemini(action, body, req, res);
        }
        if (service === 'google') {
            if (!(GOOGLE_ACTIONS as readonly string[]).includes(action)) {
                throw new HttpError(400, 'unknown-action', `Unknown google action: ${action}`);
            }
            return await handleGoogle(action, body, req, res);
        }
        throw new HttpError(400, 'unknown-service', `Unknown service: ${service}`);
    } catch (err) {
        return sendError(res, err);
    }
}

// ---------------------------------------------------------------------------
// Origin allow-list
// ---------------------------------------------------------------------------

const DEFAULT_ALLOWED_ORIGINS = [
    'https://aurora-sigma-indol.vercel.app',
    'https://aurora-danny-clarks-projects.vercel.app',
    'https://aurora-git-main-danny-clarks-projects.vercel.app',
    'https://aurora-9sh2.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
];
// Preview deployments of this project, e.g. https://aurora-abc123-danny-clarks-projects.vercel.app
const PREVIEW_ORIGIN_RE = /^https:\/\/aurora-[a-z0-9-]+-danny-clarks-projects\.vercel\.app$/;

function header(req: ProxyRequest, name: string): string | undefined {
    const v = req.headers[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
}

/** Origin header, falling back to the origin of the Referer. Returns null if neither is usable. */
function requestOrigin(req: ProxyRequest): string | null {
    const origin = header(req, 'origin');
    if (origin && origin !== 'null') return origin.replace(/\/+$/, '').toLowerCase();
    const referer = header(req, 'referer');
    if (referer) {
        try { return new URL(referer).origin.toLowerCase(); } catch { /* invalid referer */ }
    }
    return null;
}

function isAllowedOrigin(origin: string): boolean {
    if (DEFAULT_ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN_RE.test(origin)) return true;
    const extra = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim().replace(/\/+$/, '').toLowerCase())
        .filter(Boolean);
    if (extra.includes(origin)) return true;
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl && origin === `https://${vercelUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase()}`) return true;
    return false;
}

function parseBody(raw: unknown): Body {
    if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw as Body;
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : typeof raw === 'string' ? raw : '';
    if (!text) throw new HttpError(400, 'bad-request', 'Missing JSON request body.');
    try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
        return parsed as Body;
    } catch {
        throw new HttpError(400, 'invalid-json', 'Request body is not valid JSON.');
    }
}

/** The genai SDK often puts the raw upstream JSON in `message`; pull out the human-readable part. */
function unwrapUpstreamMessage(msg: string): string {
    let current = msg;
    for (let i = 0; i < 3; i++) {
        try {
            const parsed = JSON.parse(current);
            const inner = parsed?.error?.message ?? parsed?.message;
            if (typeof inner !== 'string' || !inner) break;
            current = inner;
        } catch {
            break;
        }
    }
    return current;
}

function sendError(res: ProxyResponse, err: unknown) {
    let status = 500;
    let code = 'internal-error';
    let message = 'Unexpected server error.';
    if (err instanceof HttpError) {
        ({ status, code, message } = err);
    } else if (err && typeof err === 'object') {
        // @google/genai ApiError exposes the upstream HTTP status.
        const e = err as { status?: unknown; message?: unknown };
        if (typeof e.status === 'number' && e.status >= 400 && e.status < 600) {
            status = e.status;
            code = 'upstream-error';
        } else {
            status = 502;
            code = 'upstream-error';
        }
        if (typeof e.message === 'string' && e.message) message = unwrapUpstreamMessage(e.message);
    }
    if (status >= 500) console.error(`[api/proxy] ${code}:`, err);
    if (res.headersSent) {
        // Mid-stream failure: we can only append to the body and close it.
        try { res.end(`\n\n[Error: ${message}]`); } catch { /* ignore */ }
        return;
    }
    res.status(status).json({ error: code, message });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireString(body: Body, key: string, max = 200_000): string {
    const v = body[key];
    if (typeof v !== 'string' || !v.trim()) {
        throw new HttpError(400, 'bad-request', `Missing or invalid "${key}" (expected a non-empty string).`);
    }
    if (v.length > max) throw new HttpError(413, 'payload-too-large', `"${key}" is too long.`);
    return v;
}

function clampInt(v: unknown, def: number, min: number, max: number): number {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, Math.floor(n)));
}

function bearerToken(req: ProxyRequest): string {
    const h = req.headers['authorization'] ?? req.headers['Authorization' as 'authorization'];
    const value = Array.isArray(h) ? h[0] : h;
    const m = typeof value === 'string' ? value.match(/^Bearer\s+(.+)$/i) : null;
    if (!m || !m[1].trim()) {
        throw new HttpError(401, 'missing-access-token', 'Missing Google access token. Please sign in with Google.');
    }
    return m[1].trim();
}

let aiClient: GoogleGenAI | null = null;
function getAi(): { ai: GoogleGenAI; apiKey: string } {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new HttpError(500, 'missing-api-key', 'GEMINI_API_KEY is not configured on the server.');
    }
    if (!aiClient) aiClient = new GoogleGenAI({ apiKey });
    return { ai: aiClient, apiKey };
}

/** Serialise a GenerateContentResponse with explicit fields (SDK getters don't survive JSON). */
function serializeResponse(r: GenerateContentResponse) {
    return {
        text: r.text ?? '',
        functionCalls: r.functionCalls ?? [],
        candidates: r.candidates ?? [],
        usageMetadata: r.usageMetadata,
    };
}

function pickTextModel(requested: unknown): string {
    // Only allow Gemini text models to be selected by the client.
    return typeof requested === 'string' && /^gemini-[\w.-]+$/.test(requested) ? requested : MODELS.text;
}

interface ClientChatMessage { role?: string; text?: string; image?: { data?: string; mimeType?: string } }

function buildChatRequest(body: Body) {
    const history: ClientChatMessage[] = Array.isArray(body.chatHistory) ? body.chatHistory : [];
    const newParts: Part[] = Array.isArray(body.newMessage?.parts) ? body.newMessage.parts : [];
    if (newParts.length === 0) throw new HttpError(400, 'bad-request', 'newMessage.parts must be a non-empty array.');

    const contents: Content[] = [];
    for (const m of history) {
        const parts: Part[] = [];
        if (typeof m.text === 'string' && m.text) parts.push({ text: m.text });
        if (m.image?.data && m.image?.mimeType) parts.push({ inlineData: { data: m.image.data, mimeType: m.image.mimeType } });
        if (parts.length) contents.push({ role: m.role === 'model' ? 'model' : 'user', parts });
    }
    // chatHistory excludes the message being sent; append it as the final user turn.
    contents.push({ role: 'user', parts: newParts });

    const personaPrompt = typeof body.persona?.prompt === 'string' ? body.persona.prompt : '';
    const facts: string[] = Array.isArray(body.memory)
        ? body.memory.map((m: { fact?: unknown }) => (typeof m?.fact === 'string' ? m.fact : '')).filter(Boolean)
        : [];
    let systemInstruction = personaPrompt;
    if (facts.length) {
        systemInstruction += `${systemInstruction ? '\n\n' : ''}Things you know about the user:\n- ${facts.join('\n- ')}`;
    }
    const tools: Tool[] | undefined = Array.isArray(body.tools) && body.tools.length ? body.tools : undefined;
    return {
        model: MODELS.text,
        contents,
        config: { ...(systemInstruction ? { systemInstruction } : {}), ...(tools ? { tools } : {}) },
    };
}

// ---------------------------------------------------------------------------
// service: 'gemini'
// ---------------------------------------------------------------------------

async function handleGemini(action: string, body: Body, req: ProxyRequest, res: ProxyResponse) {
    // Validate inputs before touching the API key so bad requests get a 400.
    switch (action) {
        case 'runAgent':
            return res.status(200).json({
                finalAnswer:
                    'Background agents are not available yet: the server-side agent loop has not been implemented. ' +
                    `Your goal was received but not executed${typeof body.goal === 'string' ? `: "${body.goal.slice(0, 200)}"` : ''}.`,
                steps: ['Agent execution is a stub on the server (/api/proxy runAgent). No tools were run.'],
                shouldNotify: false,
                stub: true,
            });

        case 'generateText': {
            const prompt = requireString(body, 'prompt');
            const { ai } = getAi();
            const r = await ai.models.generateContent({ model: pickTextModel(body.modelName), contents: prompt });
            return res.status(200).json({ text: r.text ?? '' });
        }

        case 'generateSearch': {
            const query = requireString(body, 'query', 10_000);
            const { ai } = getAi();
            const r = await ai.models.generateContent({
                model: MODELS.text,
                contents: query,
                config: { tools: [{ googleSearch: {} }] },
            });
            return res.status(200).json(serializeResponse(r));
        }

        case 'generateMaps': {
            const query = requireString(body, 'query', 10_000);
            const latitude = Number(body.latitude);
            const longitude = Number(body.longitude);
            const hasLoc = Number.isFinite(latitude) && Number.isFinite(longitude);
            const { ai } = getAi();
            const r = await ai.models.generateContent({
                model: MODELS.text,
                contents: query,
                config: {
                    tools: [{ googleMaps: {} }],
                    ...(hasLoc ? { toolConfig: { retrievalConfig: { latLng: { latitude, longitude } } } } : {}),
                },
            });
            return res.status(200).json(serializeResponse(r));
        }

        case 'analyzeVideo': {
            const prompt = requireString(body, 'prompt', 20_000);
            const videoBase64 = requireString(body, 'videoBase64', 10_000_000);
            const mimeType = requireString(body, 'mimeType', 100);
            if (!mimeType.startsWith('video/')) throw new HttpError(400, 'bad-request', 'mimeType must be a video/* type.');
            const { ai } = getAi();
            const r = await ai.models.generateContent({
                model: MODELS.text,
                contents: [{ role: 'user', parts: [{ inlineData: { data: videoBase64, mimeType } }, { text: prompt }] }],
            });
            return res.status(200).json({ text: r.text ?? '' });
        }

        case 'generateImage': {
            const prompt = requireString(body, 'prompt', 10_000);
            const allowed = ['1:1', '3:4', '4:3', '9:16', '16:9'];
            const aspectRatio = allowed.includes(body.aspectRatio) ? body.aspectRatio : '1:1';
            const { ai } = getAi();
            const r = await ai.models.generateImages({
                model: MODELS.image,
                prompt,
                config: { numberOfImages: 1, aspectRatio, outputMimeType: 'image/png' },
            });
            const img = r.generatedImages?.[0]?.image;
            if (!img?.imageBytes) {
                throw new HttpError(502, 'no-image', 'The image model returned no image (it may have been filtered).');
            }
            return res.status(200).json({ imageUrl: `data:${img.mimeType || 'image/png'};base64,${img.imageBytes}` });
        }

        case 'generateSpeech': {
            const text = requireString(body, 'text', 20_000);
            const voiceName = typeof body.voiceName === 'string' && body.voiceName ? body.voiceName : 'Kore';
            const { ai } = getAi();
            const r = await ai.models.generateContent({
                model: MODELS.tts,
                contents: [{ role: 'user', parts: [{ text }] }],
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
                },
            });
            const base64Audio = r.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)?.inlineData?.data;
            if (!base64Audio) throw new HttpError(502, 'no-audio', 'The speech model returned no audio.');
            return res.status(200).json({ base64Audio });
        }

        case 'generateVideo': {
            const prompt = requireString(body, 'prompt', 10_000);
            const aspectRatio = body.aspectRatio === '9:16' ? '9:16' : '16:9';
            const resolution = body.resolution === '1080p' ? '1080p' : '720p';
            const { ai } = getAi();
            const op = await ai.models.generateVideos({
                model: MODELS.video,
                prompt,
                config: { numberOfVideos: 1, aspectRatio, resolution },
            });
            return res.status(200).json(serializeOperation(op));
        }

        case 'getVideosOperation': {
            const name = body.operation?.name;
            if (typeof name !== 'string' || !name) {
                throw new HttpError(400, 'bad-request', 'operation.name is required.');
            }
            const { ai } = getAi();
            const op = new GenerateVideosOperation();
            op.name = name;
            const updated = await ai.operations.getVideosOperation({ operation: op });
            return res.status(200).json(serializeOperation(updated));
        }

        case 'fetchVideo': {
            const link = requireString(body, 'downloadLink', 4_000);
            let url: URL;
            try { url = new URL(link); } catch { throw new HttpError(400, 'bad-request', 'downloadLink is not a valid URL.'); }
            // Only ever attach the API key to Google's Generative Language API host.
            if (url.protocol !== 'https:' || url.hostname !== 'generativelanguage.googleapis.com') {
                throw new HttpError(400, 'bad-request', 'downloadLink must point to generativelanguage.googleapis.com.');
            }
            const { apiKey } = getAi();
            const upstream = await fetch(url.toString(), { headers: { 'x-goog-api-key': apiKey }, redirect: 'follow' });
            if (!upstream.ok || !upstream.body) {
                throw new HttpError(upstream.status >= 400 ? upstream.status : 502, 'upstream-error', `Failed to download video (HTTP ${upstream.status}).`);
            }
            res.status(200);
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
            const len = upstream.headers.get('content-length');
            if (len) res.setHeader('Content-Length', len);
            // Stream the bytes through so large videos aren't buffered in memory.
            const reader = upstream.body.getReader();
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) res.write(value);
            }
            return res.end();
        }

        case 'generateChat': {
            const request = buildChatRequest(body);
            const { ai } = getAi();
            const r = await ai.models.generateContent(request);
            return res.status(200).json(serializeResponse(r));
        }

        case 'generateChatStream': {
            const request = buildChatRequest(body);
            const { ai } = getAi();
            const stream = await ai.models.generateContentStream(request);
            // Plain text chunks (no SSE framing): ChatView appends decoded bytes directly.
            res.status(200);
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('X-Accel-Buffering', 'no');
            for await (const chunk of stream) {
                const text = chunk.text;
                if (text) res.write(text);
            }
            return res.end();
        }

        case 'generateWithTools': {
            if (!Array.isArray(body.contents) || body.contents.length === 0) {
                throw new HttpError(400, 'bad-request', '"contents" must be a non-empty array.');
            }
            const tools: Tool[] | undefined = Array.isArray(body.tools) && body.tools.length ? body.tools : undefined;
            const { ai } = getAi();
            const r = await ai.models.generateContent({
                model: MODELS.text,
                contents: body.contents as Content[],
                config: tools ? { tools } : undefined,
            });
            return res.status(200).json(serializeResponse(r));
        }

        case 'proposeUpdate': {
            const prompt = requireString(body, 'prompt', 20_000);
            const sourceFiles: Record<string, unknown> =
                body.sourceFiles && typeof body.sourceFiles === 'object' ? body.sourceFiles : {};
            const fileDump = Object.entries(sourceFiles)
                .filter(([, v]) => typeof v === 'string')
                .map(([path, content]) => `--- FILE: ${path} ---\n${content}`)
                .join('\n\n');
            const { ai } = getAi();
            const r = await ai.models.generateContent({
                model: MODELS.pro,
                contents: `You are an expert React + TypeScript engineer working on the "Aura" app.\n` +
                    `Here is the current source code:\n\n${fileDump}\n\n` +
                    `User request: ${prompt}\n\n` +
                    `Respond with an implementation plan (markdown) and the complete new content of every file you change.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: 'OBJECT',
                        properties: {
                            plan: { type: 'STRING' },
                            changes: {
                                type: 'ARRAY',
                                items: {
                                    type: 'OBJECT',
                                    properties: {
                                        file: { type: 'STRING' },
                                        description: { type: 'STRING' },
                                        content: { type: 'STRING' },
                                    },
                                    required: ['file', 'description', 'content'],
                                },
                            },
                        },
                        required: ['plan', 'changes'],
                    } as any,
                },
            });
            try {
                return res.status(200).json(JSON.parse(r.text ?? ''));
            } catch {
                throw new HttpError(502, 'invalid-model-output', 'The model did not return valid JSON for the update proposal.');
            }
        }

        case 'getYoutubeTranscript': {
            const videoId = requireString(body, 'videoId', 64);
            if (!/^[\w-]{6,20}$/.test(videoId)) throw new HttpError(400, 'bad-request', 'Invalid YouTube videoId.');
            const { ai } = getAi();
            // Best effort: YouTube has no public transcript API, so ask Gemini to transcribe the public video URL.
            let r: GenerateContentResponse;
            try {
                r = await ai.models.generateContent({
                    model: MODELS.text,
                    contents: [{
                        role: 'user',
                        parts: [
                            { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}`, mimeType: 'video/*' } },
                            { text: 'Produce a plain-text transcript of the spoken content of this video. Output only the transcript.' },
                        ],
                    }],
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                throw new HttpError(501, 'transcript-unavailable',
                    `A transcript could not be produced for this video (it may be private, too long, or unsupported). Details: ${msg.slice(0, 300)}`);
            }
            const transcript = r.text?.trim();
            if (!transcript) {
                throw new HttpError(501, 'transcript-unavailable', 'A transcript could not be produced for this video.');
            }
            return res.status(200).json({ transcript });
        }
    }
    throw new HttpError(400, 'unknown-action', `Unknown gemini action: ${action}`);
}

function serializeOperation(op: GenerateVideosOperation) {
    return {
        name: op.name,
        done: op.done ?? false,
        error: op.error,
        metadata: op.metadata,
        response: op.response
            ? {
                generatedVideos: (op.response.generatedVideos ?? []).map(v => ({
                    video: v.video ? { uri: v.video.uri, mimeType: v.video.mimeType } : undefined,
                })),
                raiMediaFilteredCount: op.response.raiMediaFilteredCount,
                raiMediaFilteredReasons: op.response.raiMediaFilteredReasons,
            }
            : undefined,
    };
}

// ---------------------------------------------------------------------------
// service: 'google'  (plain fetch with the user's OAuth access token)
// ---------------------------------------------------------------------------

async function googleFetch(token: string, url: string, init: RequestInit = {}): Promise<any> {
    const r = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(init.headers || {}) },
    });
    if (!r.ok) {
        let message = `Google API request failed (HTTP ${r.status}).`;
        try {
            const j = await r.json();
            if (j?.error?.message) message = j.error.message;
        } catch { /* non-JSON error body */ }
        throw new HttpError(r.status, 'google-api-error', message);
    }
    if (r.status === 204) return null;
    return r.json();
}

async function googleFetchText(token: string, url: string): Promise<{ text: string; contentType: string }> {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
        let message = `Google API request failed (HTTP ${r.status}).`;
        try { const j = await r.json(); if (j?.error?.message) message = j.error.message; } catch { /* ignore */ }
        throw new HttpError(r.status, 'google-api-error', message);
    }
    return { text: await r.text(), contentType: r.headers.get('content-type') || '' };
}

const MAX_DRIVE_CHARS = 30_000;
const GOOGLE_EXPORTS: Record<string, string> = {
    'application/vnd.google-apps.document': 'text/plain',
    'application/vnd.google-apps.spreadsheet': 'text/csv',
    'application/vnd.google-apps.presentation': 'text/plain',
    'application/vnd.google-apps.drawing': 'image/svg+xml',
    'application/vnd.google-apps.script': 'application/vnd.google-apps.script+json',
};

async function handleGoogle(action: string, body: Body, req: ProxyRequest, res: ProxyResponse) {
    const token = bearerToken(req);

    switch (action) {
        case 'fetchUnreadGmail': {
            const maxResults = clampInt(body.maxResults, 5, 1, 25);
            const list = await googleFetch(token,
                `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent('is:unread in:inbox')}&maxResults=${maxResults}`);
            const ids: string[] = (list?.messages ?? []).map((m: { id: string }) => m.id);
            const messages = await Promise.all(ids.map(async id => {
                const m = await googleFetch(token,
                    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
                const headers: { name: string; value: string }[] = m?.payload?.headers ?? [];
                const h = (n: string) => headers.find(x => x.name.toLowerCase() === n.toLowerCase())?.value ?? '';
                return { id: m.id, threadId: m.threadId, from: h('From'), subject: h('Subject'), date: h('Date'), snippet: m.snippet ?? '' };
            }));
            return res.status(200).json(messages);
        }

        case 'fetchCalendarEvents': {
            const maxResults = clampInt(body.maxResults, 10, 1, 50);
            const timeMin = typeof body.timeMin === 'string' && !isNaN(Date.parse(body.timeMin))
                ? new Date(body.timeMin).toISOString()
                : new Date().toISOString();
            const params = new URLSearchParams({
                timeMin, maxResults: String(maxResults), singleEvents: 'true', orderBy: 'startTime',
            });
            const data = await googleFetch(token, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`);
            return res.status(200).json(data?.items ?? []);
        }

        case 'createCalendarEvent': {
            const event = body.event;
            if (!event || typeof event !== 'object') throw new HttpError(400, 'bad-request', '"event" object is required.');
            if (!event.summary || !event.start || !event.end) {
                throw new HttpError(400, 'bad-request', 'event.summary, event.start and event.end are required.');
            }
            const created = await googleFetch(token, 'https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
            });
            return res.status(200).json(created);
        }

        case 'searchDriveFiles': {
            const query = requireString(body, 'query', 500);
            const pageSize = clampInt(body.maxResults, 5, 1, 25);
            const escaped = query.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const params = new URLSearchParams({
                q: `(name contains '${escaped}' or fullText contains '${escaped}') and trashed = false`,
                pageSize: String(pageSize),
                fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
            });
            const data = await googleFetch(token, `https://www.googleapis.com/drive/v3/files?${params}`);
            return res.status(200).json(data?.files ?? []);
        }

        case 'getDriveFileContent': {
            const fileId = requireString(body, 'fileId', 200);
            if (!/^[\w-]+$/.test(fileId)) throw new HttpError(400, 'bad-request', 'Invalid fileId.');
            const mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';
            const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
            let text: string;
            if (mimeType.startsWith('application/vnd.google-apps.')) {
                const exportType = GOOGLE_EXPORTS[mimeType];
                if (!exportType) {
                    throw new HttpError(415, 'unsupported-file-type', `Cannot export Google file type ${mimeType} as text.`);
                }
                ({ text } = await googleFetchText(token, `${base}/export?mimeType=${encodeURIComponent(exportType)}`));
            } else if (!mimeType || /^text\/|json|xml|csv|javascript|typescript|markdown|yaml/.test(mimeType)) {
                ({ text } = await googleFetchText(token, `${base}?alt=media`));
            } else {
                return res.status(200).json({
                    fileId, mimeType, content: '', truncated: false,
                    message: `File type ${mimeType} is binary and cannot be read as text.`,
                });
            }
            const truncated = text.length > MAX_DRIVE_CHARS;
            return res.status(200).json({ fileId, mimeType, content: truncated ? text.slice(0, MAX_DRIVE_CHARS) : text, truncated });
        }

        case 'fetchYouTubeLikedVideos': {
            const maxResults = clampInt(body.maxResults, 12, 1, 50);
            const data = await googleFetch(token,
                `https://www.googleapis.com/youtube/v3/videos?myRating=like&part=snippet&maxResults=${maxResults}`);
            return res.status(200).json({ items: data?.items ?? [] });
        }
    }
    throw new HttpError(400, 'unknown-action', `Unknown google action: ${action}`);
}
