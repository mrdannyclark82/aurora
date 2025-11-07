import React, { useState, useEffect } from 'react';
import { getYoutubeTranscript, generateText } from '../services/geminiService';
import { useError } from '../contexts/ErrorContext';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { YouTubeIcon } from './icons/YouTubeIcon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { FeedbackButtons } from './FeedbackButtons';
import { useAuth } from '../contexts/AuthContext';
import { YouTubeVideo } from '../types';
import { fetchYouTubeLikedVideos } from '../services/googleApiService';

const extractVideoId = (url: string): string | null => {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
};

const VideoCard: React.FC<{ video: YouTubeVideo; onSelect: (videoId: string) => void }> = ({ video, onSelect }) => (
    <button onClick={() => onSelect(video.id)} className="w-full text-left bg-secondary p-2 rounded-lg hover:bg-border transition-colors flex items-start gap-3">
        <img src={video.snippet.thumbnails.medium.url} alt={video.snippet.title} className="w-32 aspect-video rounded object-cover" />
        <div className="flex-1">
            <h4 className="text-sm font-semibold line-clamp-2">{video.snippet.title}</h4>
            <p className="text-xs text-text-secondary mt-1">{video.snippet.channelTitle}</p>
        </div>
    </button>
);

const FeedSkeleton: React.FC = () => (
    <div className="space-y-3 animate-pulse">
        {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-2">
                <div className="w-32 h-[72px] bg-secondary rounded"></div>
                <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 bg-secondary rounded w-full"></div>
                    <div className="h-4 bg-secondary rounded w-3/4"></div>
                    <div className="h-3 bg-secondary rounded w-1/2 mt-2"></div>
                </div>
            </div>
        ))}
    </div>
);


export const YouTubeView: React.FC = () => {
    const [url, setUrl] = useState('');
    const [videoId, setVideoId] = useState<string | null>(null);
    const [transcript, setTranscript] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
    const { setError } = useError();
    const { toggleMobileNav } = useMobileNav();
    const { user, accessToken, signIn } = useAuth();
    const [feedVideos, setFeedVideos] = useState<YouTubeVideo[]>([]);
    const [isFeedLoading, setIsFeedLoading] = useState(false);
    const [rightColumnView, setRightColumnView] = useState<'feed' | 'analysis'>('feed');

    const loadVideoById = async (id: string) => {
        setIsLoadingVideo(true);
        setVideoId(id);
        setAnalysis(null);
        setQuery('');
        setTranscript(null);
        setRightColumnView('feed');

        try {
            const result = await getYoutubeTranscript(id);
            setTranscript(result.transcript);
        } catch (error: any) {
            setError(error.message || "Failed to fetch video transcript. The video may not have captions available.");
            setVideoId(null);
        } finally {
            setIsLoadingVideo(false);
        }
    };

    const handleLoadVideo = async () => {
        const id = extractVideoId(url);
        if (!id) {
            setError("Invalid YouTube URL. Please enter a valid video URL.");
            return;
        }
        setUrl(`https://www.youtube.com/watch?v=${id}`);
        await loadVideoById(id);
    };

    const handleAnalyze = async () => {
        if (!transcript || !query.trim()) {
            setError("Please load a video and enter a question.");
            return;
        }

        setIsLoadingAnalysis(true);
        setAnalysis(null);
        setRightColumnView('analysis');

        try {
            const prompt = `Based on the following YouTube video transcript, please answer the user's question.

Transcript:
---
${transcript}
---

User's Question: "${query}"

Answer:`;
            const response = await generateText(prompt, 'gemini-2.5-flash');
            setAnalysis(response.text);
        } catch (error: any) {
            setError(error.message || "Failed to analyze the video.");
        } finally {
            setIsLoadingAnalysis(false);
        }
    };

    useEffect(() => {
        const fetchFeed = async () => {
            if (accessToken) {
                setIsFeedLoading(true);
                try {
                    const response = await fetchYouTubeLikedVideos(accessToken);
                    setFeedVideos(response.items || []);
                } catch (error: any) {
                    setError("Could not load your YouTube feed. Please try re-authenticating.");
                    console.error("YouTube feed error:", error);
                } finally {
                    setIsFeedLoading(false);
                }
            }
        };
        fetchFeed();
    }, [accessToken, setError]);

    const renderRightColumn = () => {
        if (rightColumnView === 'analysis') {
            return (
                <div className="relative h-full flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">Analysis Result</h3>
                        <button onClick={() => setRightColumnView('feed')} className="text-sm text-accent hover:underline">
                            &larr; Back to Feed
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {isLoadingAnalysis ? (
                            <div className="flex items-center justify-center h-full">
                                <SpinnerIcon className="w-8 h-8 animate-spin-slow text-accent" />
                            </div>
                        ) : analysis ? (
                            <div className="markdown-content text-text-secondary">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
                            </div>
                        ) : (
                             <p className="text-text-secondary italic">
                                Ask a question to get an analysis.
                            </p>
                        )}
                    </div>
                    {analysis && !isLoadingAnalysis && (
                        <div className="absolute bottom-0 right-0">
                            <FeedbackButtons />
                        </div>
                    )}
                </div>
            );
        }
        
        if (!user) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <YouTubeIcon className="w-16 h-16 text-text-secondary mb-4" />
                    <h3 className="text-lg font-semibold">Connect Your YouTube Account</h3>
                    <p className="text-text-secondary mt-1">Sign in to see your personalized feed of liked videos.</p>
                    <button onClick={signIn} className="mt-4 px-4 py-2 bg-secondary text-text-primary rounded-lg hover:bg-border">Sign In with Google</button>
                </div>
            );
        }

        if (isFeedLoading) {
            return (
                <div>
                    <h3 className="text-lg font-semibold mb-2">Your Feed</h3>
                    <FeedSkeleton />
                </div>
            );
        }

        return (
            <div>
                <h3 className="text-lg font-semibold mb-2">Your Feed (Liked Videos)</h3>
                {feedVideos.length > 0 ? (
                    <div className="space-y-3">
                        {feedVideos.map(video => (
                            <VideoCard key={video.id} video={video} onSelect={(id) => {
                                setUrl(`https://www.youtube.com/watch?v=${id}`);
                                loadVideoById(id);
                            }} />
                        ))}
                    </div>
                ) : (
                    <p className="text-text-secondary italic text-sm">Your feed of liked videos is empty or could not be loaded. Try liking some videos on YouTube!</p>
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
                    <h2 className="text-xl font-bold">YouTube Studio</h2>
                    <p className="text-sm text-text-secondary">Analyze and get insights from YouTube videos.</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Enter a YouTube video URL"
                            className="w-full bg-primary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                            disabled={isLoadingVideo}
                        />
                        <button onClick={handleLoadVideo} disabled={isLoadingVideo || !url.trim()} className="px-4 py-2 bg-accent text-white rounded-lg disabled:opacity-50 flex-shrink-0">
                            {isLoadingVideo ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : 'Load'}
                        </button>
                    </div>

                    <div className="relative w-full aspect-video bg-primary rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                        {videoId ? (
                            <iframe
                                className="w-full h-full"
                                src={`https://www.youtube.com/embed/${videoId}`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        ) : (
                            <div className="text-center text-text-secondary p-4">
                                <YouTubeIcon className="w-16 h-16 mx-auto mb-2" />
                                <p>Load a video from your feed or a URL</p>
                            </div>
                        )}
                    </div>

                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ask a question about the video... (e.g., 'Summarize the main points')"
                        className="w-full h-24 bg-primary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                        disabled={!transcript || isLoadingAnalysis}
                    />
                    <button
                        onClick={handleAnalyze}
                        disabled={!transcript || isLoadingAnalysis || !query.trim()}
                        className="w-full p-3 rounded-lg bg-accent text-white disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-blue-500 transition-colors"
                    >
                        {isLoadingAnalysis ? (
                            <div className="flex items-center justify-center">
                                <SpinnerIcon className="w-5 h-5 mr-2 animate-spin-slow" />
                                Analyzing...
                            </div>
                        ) : (
                            'Analyze Video Content'
                        )}
                    </button>
                </div>

                <div className="bg-primary rounded-lg p-4 h-full overflow-y-auto flex flex-col">
                    {renderRightColumn()}
                </div>
            </main>
        </div>
    );
};