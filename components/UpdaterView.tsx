
import React, { useState, useMemo, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { applyUpdate, proposeUpdate } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { CodeBracketsIcon } from './icons/CodeBracketsIcon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createTwoFilesPatch } from 'diff';
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import type { FileData } from 'react-diff-view';
import 'react-diff-view/style/index.css';


const loadingMessages = [
    "Analyzing your request...",
    "Reading the application's source code...",
    "Formulating an implementation plan...",
    "Writing new code...",
    "Double-checking the proposed changes...",
    "This is a complex task, thanks for your patience...",
];

interface ProposedChange {
    file: string;
    description: string;
    content: string;
    before?: string;
}

interface AppliedUpdate {
    sha: string;
    url: string;
    unchanged: boolean;
}

interface UpdateProposal {
    plan: string;
    changes: ProposedChange[];
}

export const UpdaterView: React.FC = () => {
    const { setError } = useError();
    const { accessToken, signIn } = useAuth();
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
    const [proposal, setProposal] = useState<UpdateProposal | null>(null);
    const [applied, setApplied] = useState<AppliedUpdate | null>(null);
    const [isRecursive, setIsRecursive] = useState(false);
    const { toggleMobileNav } = useMobileNav();

    useEffect(() => {
        if (isLoading) {
            const messageInterval = setInterval(() => {
                setLoadingMessage(prev => {
                    const currentIndex = loadingMessages.indexOf(prev);
                    return loadingMessages[(currentIndex + 1) % loadingMessages.length];
                });
            }, 4000);
            return () => clearInterval(messageInterval);
        }
    }, [isLoading]);

    const handleProposeUpdate = async () => {
        if (!prompt.trim()) {
            setError("Please describe the feature or change you want to make.");
            return;
        }
        setIsLoading(true);
        setProposal(null);
        setApplied(null);
        setLoadingMessage(loadingMessages[0]);
        try {
            const enhancedPrompt = isRecursive ? `${prompt} (Perform a thorough, recursive proactive enhancement across all relevant files and subsystems to fully realize this goal).` : prompt;
            const response = await proposeUpdate(enhancedPrompt);
            if (!response.plan || !response.changes) {
                throw new Error("The AI returned an invalid response structure. Please try rephrasing your request.");
            }
            setProposal(response);
        } catch (error: any) {
            setError(error.message || "Failed to generate an update proposal.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = async () => {
        if (!proposal) return;
        if (!accessToken) {
            signIn();
            return;
        }
        setIsApplying(true);
        try {
            const result = await applyUpdate(accessToken, proposal);
            setApplied(result);
        } catch (error: any) {
            setError(error.message || 'The update could not be applied.');
        } finally {
            setIsApplying(false);
        }
    };

    const handleReset = () => {
        setPrompt('');
        setProposal(null);
        setApplied(null);
    };

    const diffs = useMemo(() => {
        if (!proposal) return [];
        return proposal.changes.map(change => {
            const oldContent = change.before || '';
            const patch = createTwoFilesPatch(change.file, change.file, oldContent, change.content, '', '', { context: 3 });
            // react-diff-view's parseDiff (backed by gitdiff-parser) expects git-style
            // unified diff text. createTwoFilesPatch emits an "Index:" line and a "===="
            // separator instead of a "diff --git" header, so normalise it first.
            const body = patch
                .split('\n')
                .filter(line => !line.startsWith('Index: ') && !/^=+$/.test(line))
                .join('\n');
            const path = change.file.replace(/^\//, '');
            const parsedFiles: FileData[] = parseDiff(`diff --git a/${path} b/${path}\n${body}`);
            const file = parsedFiles[0];
            return {
                ...change,
                diffType: (oldContent ? 'modify' : 'add') as 'modify' | 'add',
                hunks: file?.hunks ?? [],
            };
        });
    }, [proposal]);

    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">Aura Updater</h2>
                    <p className="text-sm text-text-secondary">Let Aura update its own code to add new features.</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                    {isLoading ? (
                        <div className="text-center text-text-secondary py-20">
                             <SpinnerIcon className="w-12 h-12 mx-auto animate-spin text-accent" />
                             <p className="mt-4 text-lg font-semibold">{loadingMessage}</p>
                             <p className="text-sm mt-1">Aura is thinking and writing code...</p>
                        </div>
                    ) : proposal ? (
                        <div className="animate-fade-in">
                            <div className="bg-primary p-4 rounded-lg border border-border">
                                <h3 className="text-lg font-semibold mb-2">Implementation Plan</h3>
                                <div className="markdown-content text-sm">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{proposal.plan}</ReactMarkdown>
                                </div>
                            </div>
                            <h3 className="text-lg font-semibold my-4">Proposed Code Changes:</h3>
                            <div className="space-y-4">
                                {diffs.map((diff, i) => (
                                    <div key={i} className="border border-border rounded-lg overflow-hidden">
                                        <div className="bg-primary p-2 px-4 text-sm font-mono text-text-secondary border-b border-border">{diff.file}</div>
                                        {diff.hunks.length > 0 ? (
                                            <Diff viewType="split" diffType={diff.diffType} hunks={diff.hunks}>
                                                {hunks => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
                                            </Diff>
                                        ) : (
                                            <p className="p-4 text-sm text-text-secondary">No changes.</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 flex items-center justify-between p-4 bg-primary rounded-lg border border-border">
                                {applied ? (
                                    <p className="text-green-400 font-semibold">
                                        {applied.unchanged ? 'Already on main. Nothing new to commit.' : 'Pushed to main. Vercel is deploying it.'}
                                        {' '}
                                        <a className="underline" href={applied.url} target="_blank" rel="noreferrer">View the commit</a>
                                    </p>
                                ) : (
                                    <p className="text-sm text-text-secondary">Review the diff. Apply commits it to main and deploys the live site. Sign in with Google first.</p>
                                )}
                                <div className="flex gap-3">
                                    <button onClick={handleReset} className="px-4 py-2 bg-secondary text-text-primary rounded-lg hover:bg-border">Start Over</button>
                                    <button onClick={handleApply} disabled={Boolean(applied) || isApplying} className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
                                        {applied ? 'Applied' : isApplying ? 'Committing...' : accessToken ? 'Apply to the live site' : 'Sign in to apply'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="text-center my-8 text-text-secondary">
                                <CodeBracketsIcon className="w-16 h-16 mx-auto" />
                                <h3 className="mt-4 text-xl font-semibold">Self-Evolving Codebase</h3>
                                <p className="mt-2 max-w-lg mx-auto">
                                    Describe one change and name the screen. Propose reads that file from the repo. Apply commits it to main, and Vercel deploys the live site.
                                </p>
                            </div>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g., Add a button to the Chat view that clears the conversation history."
                                className="w-full h-24 bg-primary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                            />
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="recursive"
                                    checked={isRecursive}
                                    onChange={(e) => setIsRecursive(e.target.checked)}
                                    className="rounded bg-primary border-border text-accent focus:ring-accent"
                                />
                                <label htmlFor="recursive" className="text-sm text-text-secondary cursor-pointer">
                                    Enable recursive proactive enhancements (multi-file deep refactoring)
                                </label>
                            </div>
                            <button
                                onClick={handleProposeUpdate}
                                disabled={!prompt.trim()}
                                className="w-full p-3 rounded-lg bg-accent text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
                            >
                                Propose Update
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
