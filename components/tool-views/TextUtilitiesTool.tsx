import React, { useState } from 'react';
import { generateText } from '../../services/geminiService';
import { useError } from '../../contexts/ErrorContext';
import { SpinnerIcon } from '../icons/SpinnerIcon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FeedbackButtons } from '../FeedbackButtons';

type Utility = 'summarize' | 'translate' | 'rephrase';

const utilityPrompts: Record<Utility, (text: string) => string> = {
    summarize: (text) => `Summarize the following text concisely:\n\n${text}`,
    translate: (text) => `Translate the following text to English:\n\n${text}`,
    rephrase: (text) => `Rephrase the following text to sound more professional:\n\n${text}`,
};

const utilityNames: Record<Utility, string> = {
    summarize: 'Summarize',
    translate: 'Translate to English',
    rephrase: 'Rephrase Professionally',
};

export const TextUtilitiesTool: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [activeUtility, setActiveUtility] = useState<Utility>('summarize');
    const [isLoading, setIsLoading] = useState(false);
    const [outputText, setOutputText] = useState<string | null>(null);
    const { setError } = useError();

    const handleProcess = async () => {
        if (!inputText.trim()) {
            setError('Please enter some text to process.');
            return;
        }
        setIsLoading(true);
        setOutputText(null);
        try {
            const prompt = utilityPrompts[activeUtility](inputText);
            const result = await generateText(prompt);
            setOutputText(result);
        } catch (error: any) {
            setError(error.message || 'Failed to process text.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 h-full grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <label htmlFor="text-utility-select" className="sr-only">Select Utility</label>
                    <select
                        id="text-utility-select"
                        value={activeUtility}
                        onChange={(e) => setActiveUtility(e.target.value as Utility)}
                        className="w-full bg-primary border border-border rounded-lg p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        disabled={isLoading}
                    >
                        {Object.entries(utilityNames).map(([key, name]) => (
                            <option key={key} value={key}>{name}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleProcess}
                        disabled={isLoading || !inputText.trim()}
                        className="px-6 py-2 rounded-lg bg-accent text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
                    >
                        {isLoading ? <SpinnerIcon className="w-5 h-5 animate-spin"/> : 'Process'}
                    </button>
                </div>
                <label htmlFor="text-utility-input" className="sr-only">Input Text</label>
                <textarea
                    id="text-utility-input"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter the text you want to process here..."
                    className="w-full flex-grow bg-primary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    rows={10}
                    disabled={isLoading}
                />
            </div>
            <div className="bg-primary rounded-lg border border-border p-4 overflow-y-auto relative group">
                 {isLoading && (
                    <div className="flex items-center justify-center h-full">
                        <SpinnerIcon className="w-8 h-8 animate-spin text-accent" />
                    </div>
                )}
                {outputText ? (
                    <>
                        <div className="markdown-content">
                           <ReactMarkdown remarkPlugins={[remarkGfm]}>{outputText}</ReactMarkdown>
                        </div>
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <FeedbackButtons />
                        </div>
                    </>
                ) : (
                    !isLoading && (
                        <div className="flex items-center justify-center h-full text-text-secondary">
                            <p>The processed text will appear here.</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};