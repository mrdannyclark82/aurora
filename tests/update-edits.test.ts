import { describe, expect, it } from 'vitest';
import { applyProposedEdits, buildUpdatePrompt, selectUpdateSources } from '../api/proxy';

const sources = [
    { path: '/App.tsx', content: 'export const title = "Aura";\nexport const version = 1;\n' },
    { path: '/components/ChatView.tsx', content: 'export function Chat() {\n  return <button>Send</button>;\n}\n' },
];

describe('selectUpdateSources', () => {
    it('keeps files that fit and omits the rest without slicing them', () => {
        const big = 'x'.repeat(20_000);
        const picked = selectUpdateSources({
            '/tiny.tsx': 'clear conversation',
            '/huge.tsx': big,
            '/other.tsx': 'unrelated '.repeat(100),
        }, 'clear the conversation', 1_000);
        expect(picked.included.map((file) => file.path)).toEqual(['/tiny.tsx']);
        expect(picked.omitted).toContain('/huge.tsx');
        expect(picked.included.every((file) => !file.content.endsWith('…'))).toBe(true);
    });

    it('sends only the best matching file', () => {
        const picked = selectUpdateSources({
            '/App.tsx': 'export const title = "Aura";',
            '/components/ChatView.tsx': 'export function Chat() { return "history"; }',
        }, 'add a button that clears chat history');
        expect(picked.included.map((file) => file.path)).toEqual(['/components/ChatView.tsx']);
        expect(picked.omitted).toEqual(['/App.tsx']);
    });

    it('drops a single file that is larger than the whole budget', () => {
        const picked = selectUpdateSources({ '/App.tsx': 'a'.repeat(50) }, 'anything', 20);
        expect(picked.included).toEqual([]);
        expect(picked.omitted).toEqual(['/App.tsx']);
    });
});

describe('applyProposedEdits', () => {
    it('applies ordered exact edits and returns the full file for the diff view', () => {
        const changes = applyProposedEdits(sources, [{
            file: 'components/ChatView.tsx',
            description: 'Rename the button',
            edits: [
                { find: 'Send', replace: 'Clear' },
                { find: 'Clear', replace: 'Clear history' },
            ],
        }]);
        expect(changes).toEqual([{
            file: '/components/ChatView.tsx',
            description: 'Rename the button',
            content: 'export function Chat() {\n  return <button>Clear history</button>;\n}\n',
        }]);
    });

    it('rejects a snippet that matches more than once', () => {
        expect(() => applyProposedEdits(sources, [{
            file: '/App.tsx',
            description: 'bad',
            edits: [{ find: 'export', replace: 'const' }],
        }])).toThrow(/appears 2 times/);
    });

    it('accepts a full-file rewrite when the model already returned the new text', () => {
        const changes = applyProposedEdits(sources, [{
            file: '/App.tsx',
            description: 'rewrite',
            edits: [],
            content: 'entire new file',
        }]);
        expect(changes).toEqual([{
            file: '/App.tsx',
            description: 'rewrite',
            content: 'entire new file',
        }]);
    });

    it('creates a new file from content', () => {
        const changes = applyProposedEdits(sources, [{
            file: '/components/ClearButton.tsx',
            description: 'Add a button',
            edits: [],
            content: 'export const ClearButton = () => null;\n',
        }]);
        expect(changes[0].file).toBe('/components/ClearButton.tsx');
        expect(changes[0].content).toContain('ClearButton');
    });
});

describe('buildUpdatePrompt', () => {
    it('asks for exact edits and names files that were left out', () => {
        const prompt = buildUpdatePrompt('add a clear button', sources, ['/components/UpdaterView.tsx']);
        expect(prompt).toContain('Do not return the full file');
        expect(prompt).toContain('/components/UpdaterView.tsx');
        expect(prompt).not.toContain('complete new content');
        expect(prompt).toContain('add a clear button');
    });
});
