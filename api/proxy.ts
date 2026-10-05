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
import { RepoUpdateError, commitFiles, githubClient, loadUpdateSources } from './repoUpdate';

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
    text: 'gemini-3.8-flash',
    pro: 'gemini-3.1-pro-preview',
    image: 'imagen-4.0-generate-001',
    tts: 'gemini-2.5-flash-preview-tts',
    video: 'veo-3.1-fast-generate-preview',
};

// Google rejects these for new API keys and names the replacement in the error.
const RETIRED_TEXT_MODELS: Record<string, string> = {
    'gemini-2.5-flash': MODELS.text,
    'gemini-2.5-pro': MODELS.pro,
};

const GEMINI_ACTIONS = [
    'generateText', 'getYoutubeTranscript', 'generateSearch', 'generateMaps', 'analyzeVideo',
    'generateImage', 'generateSpeech', 'generateVideo', 'getVideosOperation', 'fetchVideo',
    'generateChatStream', 'generateChat', 'generateWithTools', 'runAgent', 'proposeUpdate', 'applyUpdate',
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

function githubToken(): string {
    const token = process.env.AURORA_GITHUB_TOKEN;
    if (!token?.trim()) {
        throw new HttpError(500, 'missing-github-token', 'The updater cannot write to GitHub yet.');
    }
    return token.trim();
}

function asHttp(err: unknown): Error {
    if (err instanceof RepoUpdateError) return new HttpError(err.status, err.code, err.message);
    return err instanceof Error ? err : new Error(String(err));
}

const DEFAULT_UPDATER_EMAILS = ['mrdannyclark82@gmail.com'];

async function assertUpdater(req: ProxyRequest): Promise<void> {
    const token = bearerToken(req);
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
        throw new HttpError(401, 'missing-access-token', 'Sign in with Google again, then apply the update.');
    }
    const info = await response.json() as { email?: unknown };
    const email = typeof info.email === 'string' ? info.email.toLowerCase() : '';
    const allowed = (process.env.AURORA_UPDATER_EMAILS || DEFAULT_UPDATER_EMAILS.join(','))
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    if (!email || !allowed.includes(email)) {
        throw new HttpError(403, 'forbidden', 'This Google account cannot apply updates to Aura.');
    }
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
    const name = typeof requested === 'string' && /^gemini-[\w.-]+$/.test(requested) ? requested : MODELS.text;
    return RETIRED_TEXT_MODELS[name] ?? name;
}

// gemini-3.8-flash is the model Google names, and it 503s under load.
// These answered while 3.8 was returning "high demand".
const TEXT_FALLBACKS = [MODELS.text, 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];

// Self-update cannot start on gemini-3.1-pro-preview. That model either 503s or
// holds the function until Vercel kills it at 60s. A 503 is fast, so walk the
// models that have answered on this key. The first one that accepts gets the
// rest of the minute. Do not split that minute across models that are still working.
const UPDATE_MODELS = [
    'gemini-3-flash-preview',
    'gemini-flash-lite-latest',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
] as const;
const UPDATE_ATTEMPT_MS = 48_000;
const UPDATE_BUDGET_MS = 55_000;
const UPDATE_SOURCE_BUDGET = 28_000;
const UPDATE_MAX_OUTPUT_TOKENS = 4_096;

function modelChain(preferred: string, fallbacks: string[]): string[] {
    return [preferred, ...fallbacks.filter((model) => model !== preferred)];
}

function isCapacityError(err: unknown): boolean {
    const status = err && typeof err === 'object' && 'status' in err ? (err as { status?: unknown }).status : undefined;
    const message = err instanceof Error ? err.message : String(err);
    if (status === 429 || status === 503) return true;
    return /high demand|overloaded|resource exhausted|try again later|UNAVAILABLE/i.test(message);
}

async function withModelFallback<T>(models: string[], run: (model: string) => Promise<T>): Promise<T> {
    let last: unknown;
    for (let i = 0; i < models.length; i++) {
        try {
            return await run(models[i]);
        } catch (err) {
            last = err;
            if (i === models.length - 1 || !isCapacityError(err)) throw err;
            console.warn(`[api/proxy] ${models[i]} busy, trying ${models[i + 1]}`);
        }
    }
    throw last;
}

function isGiveUpError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const name = 'name' in err ? String((err as { name?: unknown }).name) : '';
    if (name === 'AbortError' || name === 'TimeoutError') return true;
    const status = 'status' in err ? (err as { status?: unknown }).status : undefined;
    if (status === 504) return true;
    const message = err instanceof Error ? err.message : String(err);
    return /aborted|AbortError|TimeoutError|operation was aborted/i.test(message);
}

export interface UpdateSource {
    path: string;
    content: string;
}

/** Keep the update prompt inside the 60s function. Never slice a file in half: a partial file makes exact edits miss. */
export function selectUpdateSources(sourceFiles: unknown, prompt: string, budget = UPDATE_SOURCE_BUDGET, maxFiles = 1): { included: UpdateSource[]; omitted: string[] } {
    const files: UpdateSource[] = [];
    if (sourceFiles && typeof sourceFiles === 'object') {
        for (const [path, content] of Object.entries(sourceFiles as Record<string, unknown>)) {
            if (typeof content !== 'string' || path.length === 0 || path.length > 180 || path.includes('..')) continue;
            files.push({ path, content });
        }
    }
    const tokens = prompt.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3);
    const score = (file: UpdateSource) => {
        const name = file.path.toLowerCase();
        const body = file.content.toLowerCase();
        let hits = 0;
        for (const token of tokens) {
            if (name.includes(token) || body.includes(token)) hits++;
        }
        return hits;
    };
    const ranked = [...files].sort((a, b) => score(b) - score(a) || a.content.length - b.content.length);
    const included: UpdateSource[] = [];
    const omitted: string[] = [];
    let used = 0;
    for (const file of ranked) {
        const tooBig = file.content.length > budget || included.length >= maxFiles || used + file.content.length > budget;
        if (tooBig) {
            omitted.push(file.path);
            continue;
        }
        included.push(file);
        used += file.content.length;
    }
    return { included, omitted };
}

export function buildUpdatePrompt(prompt: string, included: UpdateSource[], omitted: string[]): string {
    const fileDump = included
        .map((file) => `--- FILE: ${file.path} ---\n${file.content}`)
        .join('\n\n');
    const omittedLine = omitted.length
        ? `Files not included (do not edit these; you do not have their contents): ${omitted.join(', ')}\n\n`
        : '';
    return `You are an expert React + TypeScript engineer editing the "Aura" app.\n` +
        `Make the smallest exact edit that satisfies the request.\n` +
        `Return JSON with a short markdown "plan" and "changes".\n` +
        `Each change is { "file", "description", "edits": [{ "find", "replace" }] }.\n` +
        `Copy "find" exactly from the file. It must occur once. Keep each find under 40 lines.\n` +
        `Do not return the full file. Apply edits in order; later finds see earlier replacements.\n` +
        `To create a file that is not listed, use an empty edits array and a "content" string.\n` +
        `Change at most 3 files.\n\n` +
        omittedLine +
        `Current source:\n\n${fileDump}\n\n` +
        `User request: ${prompt}`;
}

const UPDATE_RESPONSE_SCHEMA = {
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
                    edits: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                find: { type: 'STRING' },
                                replace: { type: 'STRING' },
                            },
                            required: ['find', 'replace'],
                        },
                    },
                },
                required: ['file', 'description', 'edits'],
            },
        },
    },
    required: ['plan', 'changes'],
};

function countOccurrences(haystack: string, needle: string): number {
    if (!needle) return 0;
    let count = 0;
    let from = 0;
    while (from <= haystack.length) {
        const at = haystack.indexOf(needle, from);
        if (at < 0) return count;
        count++;
        from = at + needle.length;
    }
    return count;
}

function resolveSourcePath(requested: string, sources: Map<string, string>): string | null {
    if (sources.has(requested)) return requested;
    const withSlash = requested.startsWith('/') ? requested : `/${requested}`;
    const withoutSlash = requested.replace(/^\/+/, '');
    if (sources.has(withSlash)) return withSlash;
    if (sources.has(withoutSlash)) return withoutSlash;
    const hits = [...sources.keys()].filter((path) => path === withSlash || path.endsWith(`/${withoutSlash}`));
    return hits.length === 1 ? hits[0] : null;
}

export function applyProposedEdits(
    sources: UpdateSource[],
    rawChanges: unknown,
): { file: string; description: string; content: string }[] {
    if (!Array.isArray(rawChanges) || rawChanges.length === 0) {
        throw new HttpError(502, 'invalid-model-output', 'The model did not propose any file changes.');
    }
    if (rawChanges.length > 4) {
        throw new HttpError(502, 'invalid-model-output', 'The model proposed too many files for one update. Ask for a smaller change.');
    }
    const working = new Map(sources.map((source) => [source.path, source.content]));
    const applied: { file: string; description: string; content: string }[] = [];

    for (const raw of rawChanges) {
        if (!raw || typeof raw !== 'object') {
            throw new HttpError(502, 'invalid-model-output', 'A proposed change was not an object.');
        }
        const change = raw as { file?: unknown; description?: unknown; edits?: unknown; content?: unknown };
        const requested = typeof change.file === 'string' ? change.file.trim() : '';
        if (!requested || requested.includes('..') || requested.length > 180) {
            throw new HttpError(502, 'invalid-model-output', 'A proposed change named a file that cannot be edited.');
        }
        const description = typeof change.description === 'string' && change.description.trim()
            ? change.description.trim().slice(0, 500)
            : 'Updated.';
        const existing = resolveSourcePath(requested, working);
        const edits = Array.isArray(change.edits) ? change.edits : null;
        if (!edits || edits.length > 6) {
            throw new HttpError(502, 'invalid-model-output', `The change for ${requested} did not include a short list of edits.`);
        }

        if (!existing) {
            if (edits.length > 0 || typeof change.content !== 'string' || !change.content.trim()) {
                throw new HttpError(502, 'invalid-model-output', `${requested} is not in the source sent with this request. New files need content and no edits.`);
            }
            if (change.content.length > 12_000) {
                throw new HttpError(502, 'invalid-model-output', `${requested} is too large to create in one update.`);
            }
            const path = requested.startsWith('/') ? requested : `/${requested}`;
            working.set(path, change.content);
            applied.push({ file: path, description, content: change.content });
            continue;
        }

        if (edits.length === 0) {
            throw new HttpError(502, 'invalid-model-output', `${existing} needs at least one exact edit. Full-file rewrites time out.`);
        }
        let next = working.get(existing) ?? '';
        for (const edit of edits) {
            if (!edit || typeof edit !== 'object') {
                throw new HttpError(502, 'invalid-model-output', `An edit for ${existing} was empty.`);
            }
            const find = (edit as { find?: unknown }).find;
            const replace = (edit as { replace?: unknown }).replace;
            if (typeof find !== 'string' || !find.trim() || find.length > 2_500) {
                throw new HttpError(502, 'invalid-model-output', `An edit for ${existing} was missing a short exact snippet.`);
            }
            if (typeof replace !== 'string' || replace.length > 6_000) {
                throw new HttpError(502, 'invalid-model-output', `The replacement for ${existing} is too large. Ask for a smaller change.`);
            }
            const hits = countOccurrences(next, find);
            if (hits !== 1) {
                throw new HttpError(502, 'invalid-model-output',
                    hits === 0
                        ? `Could not find that snippet in ${existing}. Try the request again.`
                        : `That snippet appears ${hits} times in ${existing}. The edit has to match one place.`);
            }
            next = next.replace(find, replace);
        }
        working.set(existing, next);
        applied.push({ file: existing, description, content: next });
    }
    return applied;
}

function parseModelJson(text: string): { plan?: unknown; changes?: unknown } {
    const trimmed = text.trim();
    const tryParse = (value: string) => {
        const parsed = JSON.parse(value) as { plan?: unknown; changes?: unknown };
        if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
        return parsed;
    };
    try {
        return tryParse(trimmed);
    } catch {
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try { return tryParse(trimmed.slice(start, end + 1)); } catch { /* fall through */ }
        }
        throw new HttpError(502, 'invalid-model-output', 'The model did not return valid JSON for the update proposal.');
    }
}

async function generateUpdate(ai: GoogleGenAI, contents: string): Promise<GenerateContentResponse> {
    const started = Date.now();
    let last: unknown;
    for (let i = 0; i < UPDATE_MODELS.length; i++) {
        const model = UPDATE_MODELS[i];
        const left = UPDATE_BUDGET_MS - (Date.now() - started);
        if (left < 12_000) break;
        const slice = Math.min(UPDATE_ATTEMPT_MS, left);
        try {
            return await ai.models.generateContent({
                model,
                contents,
                config: {
                    abortSignal: AbortSignal.timeout(slice),
                    maxOutputTokens: UPDATE_MAX_OUTPUT_TOKENS,
                    responseMimeType: 'application/json',
                    responseSchema: UPDATE_RESPONSE_SCHEMA as any,
                },
            });
        } catch (err) {
            last = err;
            const retryable = isCapacityError(err) || isGiveUpError(err);
            const roomForAnother = i < UPDATE_MODELS.length - 1 && (UPDATE_BUDGET_MS - (Date.now() - started)) >= 12_000;
            if (!retryable || !roomForAnother) {
                if (isGiveUpError(err)) {
                    throw new HttpError(504, 'update-timeout', 'The update model did not answer in time. Hit Propose once more.');
                }
                throw err;
            }
            const why = isGiveUpError(err) ? 'timed out' : 'was busy';
            console.warn(`[api/proxy] ${model} ${why}, trying ${UPDATE_MODELS[i + 1]}`);
        }
    }
    throw last instanceof Error
        ? last
        : new HttpError(504, 'update-timeout', 'The update model did not answer in time. Hit Propose once more.');
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
            const r = await withModelFallback(modelChain(pickTextModel(body.modelName), TEXT_FALLBACKS), (model) =>
                ai.models.generateContent({ model, contents: prompt }));
            return res.status(200).json({ text: r.text ?? '' });
        }

        case 'generateSearch': {
            const query = requireString(body, 'query', 10_000);
            const { ai } = getAi();
            const r = await withModelFallback(TEXT_FALLBACKS, (model) => ai.models.generateContent({
                model,
                contents: query,
                config: { tools: [{ googleSearch: {} }] },
            }));
            return res.status(200).json(serializeResponse(r));
        }

        case 'generateMaps': {
            const query = requireString(body, 'query', 10_000);
            const latitude = Number(body.latitude);
            const longitude = Number(body.longitude);
            const hasLoc = Number.isFinite(latitude) && Number.isFinite(longitude);
            const { ai } = getAi();
            const r = await withModelFallback(TEXT_FALLBACKS, (model) => ai.models.generateContent({
                model,
                contents: query,
                config: {
                    tools: [{ googleMaps: {} }],
                    ...(hasLoc ? { toolConfig: { retrievalConfig: { latLng: { latitude, longitude } } } } : {}),
                },
            }));
            return res.status(200).json(serializeResponse(r));
        }

        case 'analyzeVideo': {
            const prompt = requireString(body, 'prompt', 20_000);
            const videoBase64 = requireString(body, 'videoBase64', 10_000_000);
            const mimeType = requireString(body, 'mimeType', 100);
            if (!mimeType.startsWith('video/')) throw new HttpError(400, 'bad-request', 'mimeType must be a video/* type.');
            const { ai } = getAi();
            const r = await withModelFallback(TEXT_FALLBACKS, (model) => ai.models.generateContent({
                model,
                contents: [{ role: 'user', parts: [{ inlineData: { data: videoBase64, mimeType } }, { text: prompt }] }],
            }));
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
            const r = await withModelFallback(TEXT_FALLBACKS, (model) =>
                ai.models.generateContent({ ...request, model }));
            return res.status(200).json(serializeResponse(r));
        }

        case 'generateChatStream': {
            const request = buildChatRequest(body);
            const { ai } = getAi();
            const stream = await withModelFallback(TEXT_FALLBACKS, (model) =>
                ai.models.generateContentStream({ ...request, model }));
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
            const r = await withModelFallback(TEXT_FALLBACKS, (model) => ai.models.generateContent({
                model,
                contents: body.contents as Content[],
                config: tools ? { tools } : undefined,
            }));
            return res.status(200).json(serializeResponse(r));
        }

        case 'proposeUpdate': {
            const prompt = requireString(body, 'prompt', 8_000);
            let included: { path: string; content: string }[];
            let omitted: string[];
            try {
                ({ included, omitted } = await loadUpdateSources(githubClient(githubToken()), prompt));
            } catch (err) {
                throw asHttp(err);
            }
            if (included.length === 0) {
                throw new HttpError(400, 'bad-request', 'Name the screen you want changed. No source file matched that request.');
            }
            const { ai } = getAi();
            const r = await generateUpdate(ai, buildUpdatePrompt(prompt, included, omitted));
            const finish = r.candidates?.[0]?.finishReason;
            if (finish === 'MAX_TOKENS') {
                throw new HttpError(502, 'invalid-model-output', 'The update was too large to finish. Ask for a smaller change.');
            }
            const parsed = parseModelJson(r.text ?? '');
            const plan = typeof parsed.plan === 'string' ? parsed.plan.trim() : '';
            if (!plan) {
                throw new HttpError(502, 'invalid-model-output', 'The model did not return an implementation plan.');
            }
            const changes = applyProposedEdits(included, parsed.changes).map((change) => ({
                ...change,
                before: included.find((file) => file.path === change.file)?.content ?? '',
            }));
            return res.status(200).json({ plan: plan.slice(0, 8_000), changes });
        }

        case 'applyUpdate': {
            await assertUpdater(req);
            const plan = requireString(body, 'plan', 8_000);
            if (!Array.isArray(body.changes) || body.changes.length === 0) {
                throw new HttpError(400, 'bad-request', 'There are no file changes to apply.');
            }
            const files = body.changes.map((change: { file?: unknown; content?: unknown }) => {
                if (!change || typeof change.file !== 'string' || typeof change.content !== 'string') {
                    throw new HttpError(400, 'bad-request', 'Each change needs a file and its new content.');
                }
                return { path: change.file, content: change.content };
            });
            try {
                const result = await commitFiles(githubClient(githubToken()), files, plan);
                return res.status(200).json(result);
            } catch (err) {
                throw asHttp(err);
            }
        }

        case 'getYoutubeTranscript': {
            const videoId = requireString(body, 'videoId', 64);
            if (!/^[\w-]{6,20}$/.test(videoId)) throw new HttpError(400, 'bad-request', 'Invalid YouTube videoId.');
            const { ai } = getAi();
            // Best effort: YouTube has no public transcript API, so ask Gemini to transcribe the public video URL.
            let r: GenerateContentResponse;
            try {
                r = await withModelFallback(TEXT_FALLBACKS, (model) => ai.models.generateContent({
                    model,
                    contents: [{
                        role: 'user',
                        parts: [
                            { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}`, mimeType: 'video/*' } },
                            { text: 'Produce a plain-text transcript of the spoken content of this video. Output only the transcript.' },
                        ],
                    }],
                }));
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
