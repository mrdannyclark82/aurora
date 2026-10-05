/**
 * Read Aurora's real source from GitHub and commit an approved update to main.
 * The token stays on the server. Callers must already have checked who is asking.
 */

export class RepoUpdateError extends Error {
    constructor(public status: number, public code: string, message: string, public githubStatus?: number) {
        super(message);
        this.name = 'RepoUpdateError';
    }
}

export const AURORA_REPO = {
    owner: 'mrdannyclark82',
    repo: 'aurora',
    branch: 'main',
};

const EDITABLE = /\.(tsx?|jsx?|css|md|json|html)$/i;
const BLOCKED = /(^|\/)\.env($|\.)|\.(pem|key)$|(^|\/)\.github\/|^api\/proxy\.ts$|^api\/repoUpdate\.ts$|^vercel\.json$|^package-lock\.json$/i;

export interface RepoBlob {
    path: string;
    size: number;
}

export function repoPath(input: string): string {
    const path = input.trim().replace(/^\/+/, '');
    if (!path || path.length > 180 || path.includes('..') || path.includes('\\') || path.includes('//') || path.startsWith('.')) {
        throw new RepoUpdateError(400, 'bad-path', 'That file path cannot be updated.');
    }
    if (BLOCKED.test(path) || !EDITABLE.test(path)) {
        throw new RepoUpdateError(400, 'bad-path', `${path} cannot be updated from the app.`);
    }
    return path;
}

export function commitMessage(plan: string): string {
    const line = plan.split('\n').map((part) => part.trim()).find(Boolean) ?? 'Update from Aura';
    const clean = line.replace(/^#+\s*/, '').replace(/[`*]/g, '').slice(0, 72).trim();
    return `aura-update: ${clean || 'Update from Aura'}`;
}

/** Pick the one source file whose name matches the request. A zero score edits nothing. */
export function chooseRepoFile(entries: RepoBlob[], prompt: string): string | null {
    const tokens = prompt.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3);
    let best: { path: string; score: number; size: number } | null = null;
    for (const entry of entries) {
        if (entry.size > 70_000) continue;
        let path = entry.path;
        try { path = repoPath(entry.path); } catch { continue; }
        const fileName = path.split('/').pop()?.toLowerCase() ?? path;
        const stem = fileName.replace(/\.[^.]+$/, '');
        let score = 0;
        for (const token of tokens) {
            if (stem.includes(token)) score += 3;
            else if (path.toLowerCase().includes(token)) score += 1;
        }
        if (score === 0) continue;
        if (!best || score > best.score || (score === best.score && entry.size < best.size)) {
            best = { path, score, size: entry.size };
        }
    }
    return best?.path ?? null;
}

export interface GhClient {
    (path: string, init?: { method?: string; body?: unknown }): Promise<any>;
}

export function githubClient(token: string): GhClient {
    return async (path, init) => {
        const response = await fetch(`https://api.github.com/repos/${AURORA_REPO.owner}/${AURORA_REPO.repo}/${path}`, {
            method: init?.method ?? 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json',
                'User-Agent': 'aurora-updater',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            body: init?.body === undefined ? undefined : JSON.stringify(init.body),
            signal: AbortSignal.timeout(15_000),
        });
        const text = await response.text();
        let data: any = {};
        if (text) {
            try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 200) }; }
        }
        if (!response.ok) {
            const detail = typeof data?.message === 'string' ? data.message : response.statusText;
            const status = response.status === 401 ? 500 : 502;
            const message = response.status === 401
                ? 'GitHub rejected the updater token. It needs to be refreshed.'
                : `GitHub refused the update (${response.status}): ${detail.slice(0, 180)}`;
            throw new RepoUpdateError(status, 'github-error', message, response.status);
        }
        return data;
    };
}

export async function loadUpdateSources(gh: GhClient, prompt: string): Promise<{ included: { path: string; content: string }[]; omitted: string[] }> {
    const tree = await gh(`git/trees/${AURORA_REPO.branch}?recursive=1`);
    const entries: RepoBlob[] = Array.isArray(tree?.tree)
        ? tree.tree.filter((item: any) => item?.type === 'blob' && typeof item.path === 'string').map((item: any) => ({
            path: item.path,
            size: typeof item.size === 'number' ? item.size : 0,
        }))
        : [];
    const chosen = chooseRepoFile(entries, prompt);
    if (!chosen) return { included: [], omitted: [] };
    const file = await gh(`contents/${chosen.split('/').map(encodeURIComponent).join('/')}?ref=${AURORA_REPO.branch}`);
    if (typeof file?.content !== 'string') {
        throw new RepoUpdateError(502, 'github-error', `GitHub did not return the contents of ${chosen}.`);
    }
    const content = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8');
    return { included: [{ path: chosen, content }], omitted: [] };
}

export async function commitFiles(
    gh: GhClient,
    files: { path: string; content: string }[],
    plan: string,
): Promise<{ sha: string; url: string; files: string[]; unchanged: boolean }> {
    if (files.length === 0 || files.length > 4) {
        throw new RepoUpdateError(400, 'bad-request', 'Apply one to four files at a time.');
    }
    const normalized: { path: string; content: string }[] = [];
    for (const file of files) {
        if (typeof file.content !== 'string' || file.content.length === 0 || file.content.length > 100_000) {
            throw new RepoUpdateError(400, 'bad-request', 'A file in this update is empty or too large.');
        }
        const path = repoPath(file.path);
        const previous = normalized.findIndex((item) => item.path === path);
        const next = { path, content: file.content };
        if (previous >= 0) normalized[previous] = next;
        else normalized.push(next);
    }

    const ref = await gh(`git/ref/heads/${AURORA_REPO.branch}`);
    const parent = ref?.object?.sha;
    if (typeof parent !== 'string' || !parent) {
        throw new RepoUpdateError(502, 'github-error', 'GitHub did not return the current main commit.');
    }
    const current = await gh(`git/commits/${parent}`);
    const baseTree = current?.tree?.sha;
    if (typeof baseTree !== 'string') {
        throw new RepoUpdateError(502, 'github-error', 'GitHub did not return the current tree.');
    }

    const changed: { path: string; content: string }[] = [];
    for (const file of normalized) {
        let previous: string | null = null;
        try {
            const existing = await gh(`contents/${file.path.split('/').map(encodeURIComponent).join('/')}?ref=${AURORA_REPO.branch}`);
            previous = typeof existing?.content === 'string'
                ? Buffer.from(existing.content.replace(/\n/g, ''), 'base64').toString('utf8')
                : null;
        } catch (err) {
            if (!(err instanceof RepoUpdateError) || err.githubStatus !== 404) throw err;
        }
        if (previous !== file.content) changed.push(file);
    }
    if (changed.length === 0) {
        return {
            sha: parent,
            url: `https://github.com/${AURORA_REPO.owner}/${AURORA_REPO.repo}/commit/${parent}`,
            files: normalized.map((file) => file.path),
            unchanged: true,
        };
    }

    const tree = [];
    for (const file of changed) {
        const blob = await gh('git/blobs', { method: 'POST', body: { content: file.content, encoding: 'utf-8' } });
        if (typeof blob?.sha !== 'string') throw new RepoUpdateError(502, 'github-error', `GitHub did not store ${file.path}.`);
        tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const nextTree = await gh('git/trees', { method: 'POST', body: { base_tree: baseTree, tree } });
    if (typeof nextTree?.sha !== 'string') throw new RepoUpdateError(502, 'github-error', 'GitHub did not build the new tree.');
    const created = await gh('git/commits', {
        method: 'POST',
        body: { message: commitMessage(plan), tree: nextTree.sha, parents: [parent] },
    });
    if (typeof created?.sha !== 'string') throw new RepoUpdateError(502, 'github-error', 'GitHub did not create the commit.');
    await gh(`git/refs/heads/${AURORA_REPO.branch}`, { method: 'PATCH', body: { sha: created.sha } });
    return {
        sha: created.sha,
        url: `https://github.com/${AURORA_REPO.owner}/${AURORA_REPO.repo}/commit/${created.sha}`,
        files: changed.map((file) => file.path),
        unchanged: false,
    };
}
