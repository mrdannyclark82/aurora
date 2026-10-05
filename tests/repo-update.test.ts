import { describe, expect, it } from 'vitest';
import { chooseRepoFile, commitFiles, commitMessage, repoPath, type GhClient } from '../api/repoUpdate';

const entries = [
    { path: 'App.tsx', size: 4000 },
    { path: 'components/ChatView.tsx', size: 20000 },
    { path: 'components/icons/ChatIcon.tsx', size: 400 },
    { path: 'components/Sidebar.tsx', size: 8000 },
    { path: 'api/proxy.ts', size: 30000 },
    { path: '.env.example', size: 20 },
];

describe('chooseRepoFile', () => {
    it('picks the screen named in the request and skips the proxy', () => {
        expect(chooseRepoFile(entries, 'Add a button to the Chat view that clears the conversation history.'))
            .toBe('components/ChatView.tsx');
    });

    it('returns nothing when the request does not name a file', () => {
        expect(chooseRepoFile(entries, 'make it better')).toBeNull();
    });
});

describe('repoPath', () => {
    it('rejects secret and updater files', () => {
        expect(() => repoPath('.env')).toThrow(/cannot be updated/);
        expect(() => repoPath('api/proxy.ts')).toThrow(/cannot be updated/);
        expect(() => repoPath('../etc/passwd')).toThrow(/cannot be updated/);
    });
});

describe('commitMessage', () => {
    it('keeps one short line', () => {
        expect(commitMessage('## Add a clear button\n\nMore detail')).toBe('aura-update: Add a clear button');
    });
});

describe('commitFiles', () => {
    it('creates one commit on main and moves the branch', async () => {
        const calls: { path: string; method?: string; body?: unknown }[] = [];
        const gh: GhClient = async (path, init) => {
            calls.push({ path, method: init?.method, body: init?.body });
            if (path.startsWith('git/ref/')) return { object: { sha: 'parentsha' } };
            if (path.startsWith('git/commits/parent')) return { tree: { sha: 'basesha' } };
            if (path.startsWith('contents/')) return { content: Buffer.from('old').toString('base64') };
            if (path === 'git/blobs') return { sha: 'blobsha' };
            if (path === 'git/trees') return { sha: 'treesha' };
            if (path === 'git/commits') return { sha: 'newsha' };
            if (path.startsWith('git/refs/')) return { ref: 'refs/heads/main' };
            throw new Error(`unexpected ${path}`);
        };
        const result = await commitFiles(gh, [{ path: 'components/ChatView.tsx', content: 'new file\n' }], 'Add a clear button');
        expect(result).toMatchObject({ sha: 'newsha', unchanged: false, files: ['components/ChatView.tsx'] });
        expect(result.url).toBe('https://github.com/mrdannyclark82/aurora/commit/newsha');
        const patch = calls.find((call) => call.path === 'git/refs/heads/main');
        expect(patch).toMatchObject({ method: 'PATCH', body: { sha: 'newsha' } });
    });

    it('does not commit when the file is already the proposed text', async () => {
        const gh: GhClient = async (path) => {
            if (path.startsWith('git/ref/')) return { object: { sha: 'parentsha' } };
            if (path.startsWith('git/commits/')) return { tree: { sha: 'basesha' } };
            if (path.startsWith('contents/')) return { content: Buffer.from('same\n').toString('base64') };
            throw new Error(`should not call ${path}`);
        };
        const result = await commitFiles(gh, [{ path: 'components/ChatView.tsx', content: 'same\n' }], 'no change');
        expect(result.unchanged).toBe(true);
        expect(result.sha).toBe('parentsha');
    });
});
