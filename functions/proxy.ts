import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

type Service = 'gemini' | 'google';

type ProxyRequestBody = {
    service: Service;
    action: string;
    // generic bag for action-specific params
    [key: string]: any;
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function jsonError(res: VercelResponse, code: number, message: string, details?: any) {
    res.status(code).json({ error: message, details });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return jsonError(res, 405, 'Method not allowed. Use POST.');
    }

    let body: ProxyRequestBody;
    try {
        body = typeof req.body === 'object' ? (req.body as ProxyRequestBody) : JSON.parse(req.body);
    } catch (err) {
        return jsonError(res, 400, 'Invalid JSON body', String(err));
    }

    if (!body || !body.service || !body.action) {
        return jsonError(res, 400, 'Missing required fields: service and action');
    }

    try {
        switch (body.service) {
            case 'gemini':
                return await handleGemini(body, res);
            case 'google':
                return await handleGoogle(req, body, res);
            default:
                return jsonError(res, 400, `Unknown service: ${body.service}`);
        }
    } catch (err) {
        console.error('Unhandled error in proxy:', err);
        return jsonError(res, 500, 'Internal server error', String(err));
    }
}

/* -----------------
   Gemini handlers
   ----------------- */

async function handleGemini(body: ProxyRequestBody, res: VercelResponse) {
    if (!GEMINI_API_KEY) {
        return jsonError(res, 500, 'Gemini API key not configured in GEMINI_API_KEY');
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const action = body.action;
    const params = body.params || {};

    switch (action) {
        case 'generateText': {
            const prompt = params.prompt ?? params.input ?? '';
            const model = params.model ?? 'gemini-proto';
            try {
                const result = await ai.models.generateContent({
                    model,
                    input: prompt,
                    // attach any additional params the frontend sent
                    ...(params.options ?? {}),
                });
                return res.status(200).json({ ok: true, data: result });
            } catch (err) {
                console.error('generateText error', err);
                return jsonError(res, 500, 'Gemini generateText failed', String(err));
            }
        }

        case 'generateSearch': {
            try {
                const input = params.prompt ?? params.input ?? '';
                const result = await ai.models.generateContent({
                    model: params.model ?? 'gemini-proto',
                    input,
                    tools: [{ name: 'googleSearch' }],
                    ...(params.options ?? {}),
                });
                return res.status(200).json({ ok: true, data: result });
            } catch (err) {
                console.error('generateSearch error', err);
                return jsonError(res, 500, 'Gemini generateSearch failed', String(err));
            }
        }

        case 'generateMaps': {
            try {
                const input = params.prompt ?? params.input ?? '';
                const result = await ai.models.generateContent({
                    model: params.model ?? 'gemini-proto',
                    input,
                    tools: [{ name: 'googleMaps' }],
                    ...(params.options ?? {}),
                });
                return res.status(200).json({ ok: true, data: result });
            } catch (err) {
                console.error('generateMaps error', err);
                return jsonError(res, 500, 'Gemini generateMaps failed', String(err));
            }
        }

        case 'analyzeVideo': {
            try {
                // Expect params to include a public URL or base64 video; forward to Gemini
                const input = params.videoUrl ?? params.videoBase64 ?? params.input;
                if (!input) return jsonError(res, 400, 'Missing video input for analyzeVideo');
                const result = await ai.models.generateContent({
                    model: params.model ?? 'veo',
                    input,
                    ...(params.options ?? {}),
                });
                return res.status(200).json({ ok: true, data: result });
            } catch (err) {
                console.error('analyzeVideo error', err);
                return jsonError(res, 500, 'Gemini analyzeVideo failed', String(err));
            }
        }

        case 'generateImage': {
            try {
                const prompt = params.prompt ?? params.input ?? '';
                const imageResult = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt,
                    ...(params.options ?? {}),
                });
                return res.status(200).json({ ok: true, data: imageResult });
            } catch (err) {
                console.error('generateImage error', err);
                return jsonError(res, 500, 'Gemini generateImage failed', String(err));
            }
        }

        case 'generateSpeech': {
            try {
                const input = params.text ?? params.input ?? '';
                const result = await ai.models.generateContent({
                    model: params.model ?? 'gemini-2.5-flash-preview-tts',
                    input,
                    ...(params.options ?? {}),
                });
                return res.status(200).json({ ok: true, data: result });
            } catch (err) {
                console.error('generateSpeech error', err);
                return jsonError(res, 500, 'Gemini generateSpeech failed', String(err));
            }
        }

        case 'generateVideo':
        case 'getVideosOperation':
        case 'fetchVideo': {
            // Simplified polling flow for the 'veo' model: start job, poll, return result
            try {
                if (action === 'generateVideo') {
                    const job = await ai.models.generateContent({
                        model: 'veo',
                        input: params.prompt ?? params.input ?? '',
                        ...(params.options ?? {}),
                    });
                    // job likely contains operationId or name; return it
                    return res.status(200).json({ ok: true, job });
                }

                if (action === 'getVideosOperation' || action === 'fetchVideo') {
                    const operationName = params.operationName;
                    if (!operationName) return jsonError(res, 400, 'Missing operationName');
                    // Example polling loop (non-blocking - single check here)
                    // In a real implementation repeat until done with backoff.
                    const opStatus = await ai.operations?.get?.({ name: operationName } as any).catch(() => null);
                    return res.status(200).json({ ok: true, operation: opStatus ?? { info: 'operation status unavailable' } });
                }
                return jsonError(res, 400, 'Invalid video action');
            } catch (err) {
                console.error('video actions error', err);
                return jsonError(res, 500, 'Gemini video action failed', String(err));
            }
        }

        case 'generateChatStream': {
            // Stream responses back to client. We'll send SSE-like chunks.
            if (!res) return jsonError(res, 500, 'No response stream available');
            try {
                // Set headers for streaming
                res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache, no-transform');
                res.setHeader('Connection', 'keep-alive');

                const model = params.model ?? 'gemini-chat';
                const input = params.messages ?? params.input ?? params.prompt ?? '';

                // Assume generateContentStream returns an async iterable of events/chunks
                const stream = await ai.models.generateContentStream({
                    model,
                    input,
                    ...(params.options ?? {}),
                } as any);

                // stream is an async iterable; write each chunk as a JSON string
                try {
                    for await (const chunk of stream as AsyncIterable<any>) {
                        // normalize chunk to string
                        const str = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
                        // SSE event
                        res.write(`data: ${str}\n\n`);
                    }
                } catch (streamErr) {
                    console.error('stream iteration error', streamErr);
                    // send an error event to client
                    res.write(`event: error\ndata: ${JSON.stringify({ error: String(streamErr) })}\n\n`);
                } finally {
                    // signal end
                    res.write('event: done\ndata: {}\n\n');
                    res.end();
                }
                return;
            } catch (err) {
                console.error('generateChatStream error', err);
                return jsonError(res, 500, 'Gemini generateChatStream failed', String(err));
            }
        }

        case 'generateChat': {
            try {
                const model = params.model ?? 'gemini-chat';
                const messages = params.messages ?? params.input ?? '';
                const resp = await ai.models.generateContent({
                    model,
                    input: messages,
                    ...(params.options ?? {}),
                });
                return res.status(200).json({ ok: true, data: resp });
            } catch (err) {
                console.error('generateChat error', err);
                return jsonError(res, 500, 'Gemini generateChat failed', String(err));
            }
        }

        case 'generateWithTools': {
            try {
                const model = params.model ?? 'gemini-proto';
                const result = await ai.models.generateContent({
                    model,
                    input: params.contents ?? params.input,
                    tools: params.tools ?? undefined,
                    ...(params.options ?? {}),
                });
                return res.status(200).json({ ok: true, data: result });
            } catch (err) {
                console.error('generateWithTools error', err);
                return jsonError(res, 500, 'Gemini generateWithTools failed', String(err));
            }
        }

        case 'runAgent': {
            // Placeholder implementation
            return res.status(200).json({
                ok: true,
                message: 'runAgent is a placeholder in this single-file implementation. Agent loop not implemented.',
            });
        }

        default:
            return jsonError(res, 400, `Unknown gemini action: ${action}`);
    }
}

/* -----------------
   Google handlers
   ----------------- */

async function handleGoogle(req: VercelRequest, body: ProxyRequestBody, res: VercelResponse) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return jsonError(res, 401, 'Missing Authorization Bearer token');
    }
    const accessToken = authHeader.split(' ')[1];
    if (!accessToken) return jsonError(res, 401, 'Invalid Bearer token');

    const oAuth2Client = new OAuth2Client();
    oAuth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    const action = body.action;
    const params = body.params || {};

    try {
        switch (action) {
            case 'fetchUnreadGmail': {
                // List message IDs matching UNREAD
                const listRes = await gmail.users.messages.list({
                    userId: 'me',
                    q: 'is:unread',
                    maxResults: params.maxResults ?? 50,
                });
                const ids = listRes.data.messages ?? [];
                // Optionally fetch each message basic metadata
                const messages = [];
                for (const m of ids) {
                    try {
                        const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] });
                        messages.push(msg.data);
                    } catch (e) {
                        // non-fatal; continue
                        console.warn('Failed to fetch message', m.id, e);
                    }
                }
                return res.status(200).json({ ok: true, messages });
            }

            case 'fetchCalendarEvents': {
                const now = new Date().toISOString();
                const eventsRes = await calendar.events.list({
                    calendarId: params.calendarId ?? 'primary',
                    timeMin: params.timeMin ?? now,
                    maxResults: params.maxResults ?? 50,
                    singleEvents: true,
                    orderBy: 'startTime',
                });
                return res.status(200).json({ ok: true, events: eventsRes.data.items ?? [] });
            }

            case 'createCalendarEvent': {
                if (!params.event) return jsonError(res, 400, 'Missing event in params');
                const insertRes = await calendar.events.insert({
                    calendarId: params.calendarId ?? 'primary',
                    requestBody: params.event,
                });
                return res.status(200).json({ ok: true, event: insertRes.data });
            }

            case 'searchDriveFiles': {
                const q = params.q ?? params.query ?? '';
                const listRes = await drive.files.list({
                    q,
                    pageSize: params.pageSize ?? 100,
                    fields: 'files(id,name,mimeType,parents,modifiedTime,owners)',
                });
                return res.status(200).json({ ok: true, files: listRes.data.files ?? [] });
            }

            case 'getDriveFileContent': {
                const fileId = params.fileId ?? params.id;
                if (!fileId) return jsonError(res, 400, 'Missing fileId param');

                // First fetch file metadata to detect mimeType
                const meta = await drive.files.get({ fileId, fields: 'id,name,mimeType' });
                const mimeType = meta.data.mimeType;
                // Google Docs/Sheets/Slides exportable types:
                const googleMimePrefix = 'application/vnd.google-apps';
                if (mimeType && mimeType.startsWith(googleMimePrefix)) {
                    // Choose an export MIME type if provided or default to PDF
                    const exportMime = params.exportMimeType ?? 'application/pdf';
                    const exported = await drive.files.export(
                        { fileId, mimeType: exportMime },
                        { responseType: 'arraybuffer' },
                    );
                    const buffer = Buffer.from(exported.data as ArrayBuffer);
                    // Return base64 to keep JSON response safe
                    return res.status(200).json({
                        ok: true,
                        file: { id: fileId, name: meta.data.name, mimeType, exportedMimeType: exportMime, contentBase64: buffer.toString('base64') },
                    });
                } else {
                    // Binary / regular file - download media
                    const mediaRes = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(mediaRes.data as ArrayBuffer);
                    // Return base64'ified content and metadata
                    return res.status(200).json({
                        ok: true,
                        file: { id: fileId, name: meta.data.name, mimeType, contentBase64: buffer.toString('base64') },
                    });
                }
            }

            default:
                return jsonError(res, 400, `Unknown google action: ${action}`);
        }
    } catch (err) {
        console.error('Google API error', err);
        return jsonError(res, 500, 'Google API call failed', String(err));
    }
}