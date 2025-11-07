import React, { useState } from 'react';
import { generateMapsResponse } from '../services/geminiService';
import { useError } from '../contexts/ErrorContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { MapIcon } from './icons/MapIcon';
import { GroundingChunk, MapDetails } from '../types';
import { StarIcon } from './icons/StarIcon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { FeedbackButtons } from './FeedbackButtons';

const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
    <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
            <StarIcon key={i} className="w-4 h-4" filled={i < Math.round(rating)} />
        ))}
    </div>
);

const PlaceCard: React.FC<{ place: MapDetails }> = ({ place }) => (
    <div className="bg-secondary p-4 rounded-lg border border-border">
        <a 
            href={place.uri} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-lg font-semibold text-accent hover:underline"
        >
            {place.title}
        </a>
        {place.placeAnswerSources?.map((source, idx) => (
            <div key={idx} className="mt-3">
                <h4 className="text-sm font-medium text-text-secondary mb-2">Relevant Reviews:</h4>
                <div className="space-y-3">
                    {source.reviewSnippets.map((snippet, sIdx) => (
                        <div key={sIdx} className="border-l-2 border-border pl-3">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-text-primary">{snippet.author}</p>
                                <StarRating rating={snippet.starRating} />
                            </div>
                            <p className="text-sm italic text-text-secondary">"{snippet.textContent}"</p>
                            <a 
                                href={snippet.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-accent hover:underline mt-1 inline-block"
                            >
                                Read full review
                            </a>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);


export const MapsView: React.FC = () => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [resultText, setResultText] = useState<string | null>(null);
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const { setError } = useError();
    const { coordinates, loading: geoLoading, error: geoError } = useGeolocation();
    const { toggleMobileNav } = useMobileNav();

    const handleSearch = async () => {
        if (!query.trim() || !coordinates) {
            setError("Please enter a query and ensure location is enabled.");
            return;
        }
        
        setIsLoading(true);
        setResultText(null);
        setSources([]);

        try {
            const response = await generateMapsResponse(query, coordinates.latitude, coordinates.longitude);
            setResultText(response.text);
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            setSources(groundingChunks.filter(chunk => 'maps' in chunk));
        } catch (error: any) {
            setError(error.message || 'Failed to get local information.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const renderContent = () => {
        if (geoLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-text-secondary">
                    <SpinnerIcon className="w-8 h-8 animate-spin text-accent mb-4" />
                    <p>Getting your location...</p>
                </div>
            );
        }

        if (geoError) {
             return (
                <div className="flex flex-col items-center justify-center h-full text-center text-red-400">
                    <MapIcon className="w-12 h-12 mb-4" />
                    <h3 className="text-lg font-semibold">Location Error</h3>
                    <p className="max-w-md mt-1">{geoError.message}. Please enable location services in your browser and refresh the page.</p>
                </div>
            );
        }

        return (
            <div className="max-w-4xl mx-auto">
                <div className="relative mb-6">
                    <label htmlFor="maps-search-input" className="sr-only">Local Search</label>
                    <input
                        id="maps-search-input"
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearch(); } }}
                        placeholder="e.g., 'Good Italian restaurants nearby'"
                        className="w-full bg-primary border border-border rounded-lg p-3 pl-10 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        disabled={isLoading}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                        <MapIcon className="w-5 h-5" />
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
                        <h3 className="text-lg font-semibold">Find Places Near You</h3>
                        <p>Ask for recommendations like "parks with playgrounds" or "quiet cafes".</p>
                    </div>
                )}
                
                {resultText && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-primary p-4 rounded-lg relative group">
                            <div className="markdown-content text-text-primary">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{resultText}</ReactMarkdown>
                            </div>
                             <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <FeedbackButtons />
                            </div>
                        </div>
                        
                        {sources.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-text-primary mb-3">Places Mentioned</h3>
                                <div className="space-y-4">
                                    {sources.map((source, index) => 
                                        source.maps ? <PlaceCard key={index} place={source.maps} /> : null
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">Local Guide</h2>
                    <p className="text-sm text-text-secondary">Find places and get recommendations based on your location.</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                {renderContent()}
            </main>
        </div>
    );
};