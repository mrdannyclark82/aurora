/**
 * Smoke tests for api/proxy.ts (routing, validation, origin check, Google API mapping).
 * No real Gemini calls are made: GEMINI_API_KEY is unset and Google APIs are mocked.
 * Run: npx vitest run tests/proxy.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/proxy';

type Res = {
    statusCode: number; headersSent: boolean; headers: Record<string, string>; chunks: Buffer[]; body?: any; ended?: boolean;
    setHeader(k: string, v: string): void; status(c: number): Res; json(b: unknown): void; send(b: unknown): void;
    write(c: string | Uint8Array): boolean; end(c?: string | Uint8Array): void;
};

function mkRes(): Res {
    return {
        statusCode: 200, headersSent: false, headers: {}, chunks: [],
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
        status(c) { this.statusCode = c; return this; },
        json(b) { this.headersSent = true; this.body = b; },
        send(b) { this.body = b; },
        write(c) { this.headersSent = true; this.chunks.push(Buffer.from(c)); return true; },
        end(c) { if (c) this.chunks.push(Buffer.from(c)); this.ended = true; },
    };
}

const ORIGIN = 'https://aurora-sigma-indol.vercel.app';

async function call(opts: { method?: string; body?: unknown; headers?: Record<string, string> }) {
    const res = mkRes();
    await handler({ method: opts.method ?? 'POST', headers: opts.headers ?? { origin: ORIGIN }, body: opts.body }, res);
    return res;
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
    call({ body, headers: { origin: ORIGIN, ...headers } });

beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.VERCEL_URL;
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('origin check', () => {
    const unknown = { service: 'gemini', action: 'nope' };

    it.each([
        'https://aurora-sigma-indol.vercel.app',
        'https://aurora-danny-clarks-projects.vercel.app',
        'https://aurora-git-main-danny-clarks-projects.vercel.app',
        'https://aurora-9sh2.vercel.app',
        'https://aurora-7lzqr2gkl-danny-clarks-projects.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173',
    ])('allows %s', async (origin) => {
        const r = await call({ body: unknown, headers: { origin } });
        expect(r.statusCode).toBe(400);
        expect(r.body.error).toBe('unknown-action');
        expect(r.headers['access-control-allow-origin']).toBe(origin);
    });

    it.each([
        'https://evil.example',
        'https://aurora-sigma-indol.vercel.app.evil.example',
        'https://evil-danny-clarks-projects.vercel.app',
        'https://aurora-x-danny-clarks-projects.vercel.app.evil.example',
        'http://aurora-sigma-indol.vercel.app',
        'http://localhost:8080',
    ])('rejects %s with 403', async (origin) => {
        const r = await call({ body: unknown, headers: { origin } });
        expect(r.statusCode).toBe(403);
        expect(r.body.error).toBe('forbidden-origin');
        expect(r.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects requests with no Origin and no Referer', async () => {
        const r = await call({ body: unknown, headers: {} });
        expect(r.statusCode).toBe(403);
        expect(r.body.error).toBe('forbidden-origin');
    });

    it('rejects Origin: null', async () => {
        const r = await call({ body: unknown, headers: { origin: 'null' } });
        expect(r.statusCode).toBe(403);
    });

    it('falls back to the Referer origin', async () => {
        const ok = await call({ body: unknown, headers: { referer: `${ORIGIN}/some/page?x=1` } });
        expect(ok.statusCode).toBe(400);
        const bad = await call({ body: unknown, headers: { referer: 'https://evil.example/page' } });
        expect(bad.statusCode).toBe(403);
    });

    it('allows ALLOWED_ORIGINS entries and the VERCEL_URL host', async () => {
        process.env.ALLOWED_ORIGINS = 'https://a.example, https://b.example/';
        process.env.VERCEL_URL = 'custom-deploy.vercel.app';
        for (const origin of ['https://a.example', 'https://b.example', 'https://custom-deploy.vercel.app']) {
            expect((await call({ body: unknown, headers: { origin } })).statusCode).toBe(400);
        }
        expect((await call({ body: unknown, headers: { origin: 'https://c.example' } })).statusCode).toBe(403);
    });

    it('answers OPTIONS preflight from an allowed origin with 204 + CORS headers', async () => {
        const r = await call({ method: 'OPTIONS', headers: { origin: 'http://localhost:3000' } });
        expect(r.statusCode).toBe(204);
        expect(r.ended).toBe(true);
        expect(r.headers['access-control-allow-methods']).toContain('POST');
        expect(r.headers['access-control-allow-headers']).toContain('Authorization');
    });

    it('rejects OPTIONS preflight from a disallowed origin', async () => {
        const r = await call({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
        expect(r.statusCode).toBe(403);
    });
});

describe('routing and validation', () => {
    it('GET -> 405', async () => {
        const r = await call({ method: 'GET' });
        expect(r.statusCode).toBe(405);
        expect(r.headers.allow).toBe('POST');
    });
    it('missing body -> 400', async () => expect((await post(undefined)).statusCode).toBe(400));
    it('invalid JSON -> 400', async () => expect((await post('{bad')).body.error).toBe('invalid-json'));
    it('missing action -> 400', async () => expect((await post({ service: 'gemini' })).statusCode).toBe(400));
    it('unknown service -> 400', async () => expect((await post({ service: 'x', action: 'y' })).body.error).toBe('unknown-service'));
    it('bad params are rejected before the key check', async () =>
        expect((await post({ service: 'gemini', action: 'generateText' })).statusCode).toBe(400));
    it('missing GEMINI_API_KEY -> 500 missing-api-key', async () => {
        const r = await post({ service: 'gemini', action: 'generateText', prompt: 'hi' });
        expect(r.statusCode).toBe(500);
        expect(r.body.error).toBe('missing-api-key');
    });
    it('fetchVideo only allows the Generative Language host', async () =>
        expect((await post({ service: 'gemini', action: 'fetchVideo', downloadLink: 'https://evil.example/x' })).statusCode).toBe(400));
    it('runAgent returns a clear stub', async () => {
        const r = await post({ service: 'gemini', action: 'runAgent', goal: 'g' });
        expect(r.statusCode).toBe(200);
        expect(r.body.stub).toBe(true);
        expect(Array.isArray(r.body.steps)).toBe(true);
    });
    it('google actions require a Bearer token', async () =>
        expect((await post({ service: 'google', action: 'fetchCalendarEvents' })).statusCode).toBe(401));
});

describe('google service (mocked fetch)', () => {
    const auth = { authorization: 'Bearer tok123' };
    const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
            const u = String(url);
            if (u.includes('/calendar/') && init?.method === 'POST') return J({ id: 'new', ...JSON.parse(String(init.body)) });
            if (u.includes('/calendar/')) return J({ items: [{ id: 'e1', summary: 'S', start: { dateTime: 'x' }, end: {} }] });
            if (u.includes('/messages?')) return J({ messages: [{ id: 'm1' }] });
            if (u.includes('/messages/')) return J({ id: 'm1', threadId: 't', snippet: 'hi', payload: { headers: [{ name: 'From', value: 'a@b' }, { name: 'Subject', value: 'Sub' }] } });
            if (u.includes('/drive/v3/files?')) return J({ files: [{ id: 'f1', name: 'N', mimeType: 'text/plain' }] });
            if (u.includes('/export?')) return new Response('doc text', { status: 200 });
            if (u.includes('/youtube/')) return J({ error: { code: 403, message: 'YouTube Data API has not been used' } }, 403);
            return J({}, 404);
        }));
    });

    it('fetchCalendarEvents -> array', async () => {
        const r = await post({ service: 'google', action: 'fetchCalendarEvents' }, auth);
        expect(r.body[0].id).toBe('e1');
    });
    it('fetchUnreadGmail -> [{from, subject, snippet}]', async () => {
        const r = await post({ service: 'google', action: 'fetchUnreadGmail' }, auth);
        expect(r.body[0]).toMatchObject({ from: 'a@b', subject: 'Sub', snippet: 'hi' });
    });
    it('createCalendarEvent', async () => {
        const r = await post({ service: 'google', action: 'createCalendarEvent', event: { summary: 'x', start: {}, end: {} } }, auth);
        expect(r.body.id).toBe('new');
    });
    it('Drive search + Google Doc export', async () => {
        expect((await post({ service: 'google', action: 'searchDriveFiles', query: "it's" }, auth)).body[0].id).toBe('f1');
        const r = await post({ service: 'google', action: 'getDriveFileContent', fileId: 'f1', mimeType: 'application/vnd.google-apps.document' }, auth);
        expect(r.body.content).toBe('doc text');
    });
    it('passes Google error statuses through', async () => {
        const r = await post({ service: 'google', action: 'fetchYouTubeLikedVideos' }, auth);
        expect(r.statusCode).toBe(403);
        expect(r.body).toMatchObject({ error: 'google-api-error', message: 'YouTube Data API has not been used' });
    });
});
