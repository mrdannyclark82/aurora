import React, { useState } from 'react';
import { generateSearchResponse } from '../services/geminiService';
import { useError } from '../contexts/ErrorContext';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { SearchIcon } from './icons/SearchIcon';
import { GroundingChunk } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { FeedbackButtons } from './FeedbackButtons';

export const SearchView: React.FC = () => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [resultText, setResultText] = useState<string | null>(null);
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const { setError } = useError();
    const { toggleMobileNav } = useMobileNav();

    const handleSearch = async () => {
        if (!query.trim()) return;
        
        setIsLoading(true);
        setResultText(null);
        setSources([]);

        try {
            const response = await generateSearchResponse(query);
            setResultText(response.text);
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            setSources(groundingChunks.filter(chunk => chunk.web)); 
        } catch (error: any) {
            setError(error.message || 'Failed to perform web search.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">Web Search</h2>
                    <p className="text-sm text-text-secondary">Get real-time answers from the web, with sources.</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="relative mb-6">
                        <label htmlFor="search-input" className="sr-only">Web Search</label>
                        <input
                            id="search-input"
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearch(); } }}
                            placeholder="Ask anything..."
                            className="w-full bg-primary border border-border rounded-lg p-3 pl-10 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                            disabled={isLoading}
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                            <SearchIcon className="w-5 h-5" />
                        </div>
                         <button 
                            onClick={handleSearch} 
                            disabled={isLoading || !query.trim()} 
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-accent text-white rounded-lg disabled:opacity-50 transition-colors"
                        >
                            {isLoading ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : 'Search'}
                        </button>
                    </div>

                    {isLoading && (
                        <div className="flex justify-center items-center mt-8">
                            <SpinnerIcon className="w-8 h-8 animate-spin text-accent" />
                        </div>
                    )}

                    {!isLoading && !resultText && (
                        <div className="text-center text-text-secondary mt-16">
                            <h3 className="text-lg font-semibold">Search the Web</h3>
                            <p>Your search results will appear here.</p>
                        </div>
                    )}
                    
                    {resultText && (
                        <div className="bg-primary p-4 rounded-lg animate-fade-in relative group">
                            <div className="markdown-content text-text-primary">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{resultText}</ReactMarkdown>
                            </div>

                            {sources.length > 0 && (
                                <div className="mt-6 border-t border-border pt-4">
                                    <h4 className="text-sm font-semibold text-text-secondary mb-2">Sources:</h4>
                                    <ul className="space-y-2">
                                        {sources.map((source, index) => (
                                            <li key={index} className="flex items-center">
                                                <span className="text-accent mr-2 text-xs">[{index + 1}]</span>
                                                <a 
                                                    href={source.web!.uri} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-accent hover:underline truncate"
                                                    title={source.web!.uri}
                                                >
                                                    {source.web!.title || source.web!.uri}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <FeedbackButtons />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};