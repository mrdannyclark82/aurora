import React, { useState, useEffect, useRef } from 'react';
import { useError } from '../contexts/ErrorContext';
import { generateVideo, getVideosOperation, fetchVideoBlob } from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { FilmIcon } from './icons/FilmIcon';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';

const loadingMessages = [
    "Warming up the digital canvas...",
    "Choreographing pixels...",
    "Rendering cinematic magic...",
    "Applying the final touches...",
    "The director is reviewing the shot...",
    "This is taking a moment, great art needs patience...",
];

export const VideoGenerationView: React.FC = () => {
    const [hasApiKey, setHasApiKey] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    const { setError } = useError();
    const pollingIntervalRef = useRef<number | null>(null);
    const { toggleMobileNav } = useMobileNav();

    useEffect(() => {
        const checkApiKey = async () => {
            if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
                const keyStatus = await window.aistudio.hasSelectedApiKey();
                setHasApiKey(keyStatus);
            } else {
                // Outside AI Studio the Gemini key lives on the server (/api/proxy), so no key selection is needed.
                setHasApiKey(true);
            }
        };
        checkApiKey();

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, []);

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

    const handleSelectKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            await window.aistudio.openSelectKey();
            setHasApiKey(true);
        } else {
            setError("API Key selection utility is not available.");
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Please enter a prompt to generate a video.");
            return;
        }

        setIsLoading(true);
        setGeneratedVideoUrl(null);
        setLoadingMessage(loadingMessages[0]);

        try {
            const initialOperation = await generateVideo(prompt, aspectRatio, resolution);
            startPolling(initialOperation);
        } catch (error: any) {
            console.error("Video generation error:", error);
            if (error.message?.includes("Requested entity was not found")) {
                setError("Your API Key is invalid or expired. Please select a valid key.");
                setHasApiKey(false);
            } else {
                setError(error.message || "Failed to start video generation.");
            }
            setIsLoading(false);
        }
    };

    const startPolling = (operation: any) => {
        pollingIntervalRef.current = window.setInterval(async () => {
            try {
                const updatedOp = await getVideosOperation(operation);
                if (updatedOp.done) {
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                    setIsLoading(false);
                    const downloadLink = updatedOp.response?.generatedVideos?.[0]?.video?.uri;
                    if (downloadLink) {
                        const blob = await fetchVideoBlob(downloadLink);
                        setGeneratedVideoUrl(URL.createObjectURL(blob));
                    } else {
                        throw new Error("Video generation finished, but no video URI was found.");
                    }
                }
            } catch (error: any) {
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                console.error("Polling error:", error);
                 if (error.message?.includes("Requested entity was not found")) {
                    setError("Your API Key became invalid during polling. Please select a valid key.");
                    setHasApiKey(false);
                } else {
                    setError(error.message || "An error occurred while checking video status.");
                }
                setIsLoading(false);
            }
        }, 10000);
    };

    const renderApiKeyPrompt = () => (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <FilmIcon className="w-16 h-16 mx-auto mb-4 text-text-secondary" />
            <h3 className="text-xl font-semibold text-text-primary">API Key Required for Video Generation</h3>
            <p className="max-w-md my-2 text-text-secondary">
                The Veo model requires you to use your own API key. Please select one to proceed.
                This service may incur costs.
            </p>
             <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline mb-4">
                Learn more about billing
            </a>
            <button onClick={handleSelectKey} className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-blue-500 transition-colors">
                Select API Key
            </button>
        </div>
    );
    
    const renderGenerator = () => (
         <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
                <label htmlFor="video-prompt-input" className="sr-only">Video Prompt</label>
                <textarea
                    id="video-prompt-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., 'A neon hologram of a cat driving at top speed'"
                    className="w-full flex-grow bg-primary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    disabled={isLoading}
                />
                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="aspectRatio" className="block text-sm font-medium text-text-secondary mb-1">Aspect Ratio</label>
                        <select
                            id="aspectRatio"
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value as any)}
                            className="w-full bg-primary border border-border rounded-lg p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                            disabled={isLoading}
                        >
                            <option value="16:9">16:9 (Landscape)</option>
                            <option value="9:16">9:16 (Portrait)</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="resolution" className="block text-sm font-medium text-text-secondary mb-1">Resolution</label>
                        <select
                            id="resolution"
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value as any)}
                             className="w-full bg-primary border border-border rounded-lg p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                            disabled={isLoading}
                        >
                            <option value="720p">720p</option>
                            <option value="1080p">1080p</option>
                        </select>
                    </div>
                </div>
                 <button
                    onClick={handleGenerate}
                    disabled={isLoading || !prompt.trim()}
                    className="w-full p-3 rounded-lg bg-accent text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
                >
                    Generate Video
                </button>
            </div>
            <div className="relative w-full aspect-video bg-primary rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                {isLoading ? (
                     <div className="text-center text-text-secondary p-4">
                        <SpinnerIcon className="w-12 h-12 mx-auto mb-4 animate-spin-slow text-accent" />
                        <p className="font-semibold">{loadingMessage}</p>
                        <p className="text-xs mt-2">Video generation can take a few minutes. Please be patient.</p>
                    </div>
                ) : generatedVideoUrl ? (
                    <>
                        <video src={generatedVideoUrl} controls className="w-full h-full object-contain" />
                         <a
                            href={generatedVideoUrl}
                            download={`${prompt.slice(0, 20).replace(/\s+/g, '_')}.mp4`}
                            className="absolute bottom-3 right-3 bg-secondary bg-opacity-70 text-white py-1 px-3 rounded-md hover:bg-opacity-100 transition-opacity text-sm"
                        >
                            Download
                        </a>
                    </>
                ) : (
                    <div className="text-center text-text-secondary p-4">
                        <FilmIcon className="w-16 h-16 mx-auto mb-2" />
                        <p>Your generated video will appear here.</p>
                    </div>
                )}
            </div>
         </div>
    );

    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">Video Generation</h2>
                    <p className="text-sm text-text-secondary">Create videos from a text description using Veo.</p>
                </div>
            </header>
            <main className="flex-1 flex flex-col">
                {hasApiKey ? renderGenerator() : renderApiKeyPrompt()}
            </main>
        </div>
    );
};
