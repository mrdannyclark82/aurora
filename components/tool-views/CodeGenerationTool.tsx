import React, { useState } from 'react';
import { generateText } from '../../services/geminiService';
import { useError } from '../../contexts/ErrorContext';
import { SpinnerIcon } from '../icons/SpinnerIcon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FeedbackButtons } from '../FeedbackButtons';

export const CodeGenerationTool: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [code, setCode] = useState<string | null>(null);
    const { setError } = useError();

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please describe the code you want to generate.');
            return;
        }
        setIsLoading(true);
        setCode(null);
        try {
            const fullPrompt = `You are a code generation expert. Generate only the code for the following request, without any extra explanation or introductory text. The user wants: "${prompt}". Provide the response inside a markdown code block.`;
            const result = await generateText(fullPrompt, 'gemini-2.5-pro');
            setCode(result.text);
        } catch (error: any) {
            setError(error.message || 'Failed to generate code.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        if (code) {
            // Extract text from markdown code block
            const codeToCopy = code.replace(/```.*\n/g, '').replace(/```/g, '');
            navigator.clipboard.writeText(codeToCopy)
                .then(() => {
                    // Optional: show a success message
                })
                .catch(err => {
                    setError('Failed to copy code to clipboard.');
                    console.error('Copy error:', err);
                });
        }
    };

    return (
        <div className="p-4 md:p-6 h-full flex flex-col">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <label htmlFor="code-prompt-input" className="sr-only">Code Prompt</label>
                <textarea
                    id="code-prompt-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., Write a python function to check if a string is a palindrome"
                    className="w-full md:flex-1 bg-primary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    rows={2}
                    disabled={isLoading}
                />
                <button
                    onClick={handleGenerate}
                    disabled={isLoading || !prompt.trim()}
                    className="p-3 rounded-lg bg-accent text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
                >
                    {isLoading ? <SpinnerIcon className="w-5 h-5 animate-spin"/> : 'Generate Code'}
                </button>
            </div>
            <div className="flex-1 bg-primary rounded-lg border border-border p-4 overflow-y-auto relative group">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary bg-opacity-75">
                        <SpinnerIcon className="w-8 h-8 animate-spin text-accent" />
                    </div>
                )}
                {code ? (
                    <>
                        <div className="absolute top-2 right-2 flex items-center gap-4">
                             <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <FeedbackButtons />
                            </div>
                            <button onClick={handleCopy} className="px-3 py-1 bg-secondary text-text-secondary text-xs rounded hover:bg-border">
                                Copy
                            </button>
                        </div>
                        <div className="markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{code}</ReactMarkdown>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-text-secondary">
                        <p>Your generated code will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};