import React, { useState } from 'react';
import { generateImage } from '../../services/geminiService';
import { useError } from '../../contexts/ErrorContext';
import { SpinnerIcon } from '../icons/SpinnerIcon';

export const ImageGenerationTool: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
    const [isLoading, setIsLoading] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const { setError } = useError();

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt for the image.');
            return;
        }
        setIsLoading(true);
        setImageUrl(null);
        try {
            const result = await generateImage(prompt, aspectRatio);
            setImageUrl(result);
        } catch (error: any) {
            setError(error.message || 'Failed to generate image.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 h-full grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
                 <label htmlFor="image-prompt-input" className="sr-only">Image Prompt</label>
                <textarea
                    id="image-prompt-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A photorealistic image of a cat wearing a spacesuit, high detail"
                    className="w-full flex-grow bg-primary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    rows={6}
                    disabled={isLoading}
                />
                <div>
                    <label htmlFor="aspectRatio" className="block text-sm font-medium text-text-secondary mb-1">Aspect Ratio</label>
                    <select
                        id="aspectRatio"
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value as any)}
                        className="w-full bg-primary border border-border rounded-lg p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        disabled={isLoading}
                    >
                        <option value="1:1">1:1 (Square)</option>
                        <option value="16:9">16:9 (Widescreen)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="4:3">4:3 (Standard)</option>
                        <option value="3:4">3:4 (Vertical)</option>
                    </select>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={isLoading || !prompt.trim()}
                    className="w-full p-3 rounded-lg bg-accent text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
                >
                    {isLoading ? 'Generating...' : 'Generate Image'}
                </button>
            </div>
            <div className="relative w-full bg-primary rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                {isLoading && (
                    <div className="text-center text-text-secondary">
                        <SpinnerIcon className="w-12 h-12 mx-auto mb-4 animate-spin-slow text-accent" />
                        <p>Creating your masterpiece...</p>
                    </div>
                )}
                {imageUrl && (
                    <>
                        <img src={imageUrl} alt={prompt} className="w-full h-full object-contain" />
                        <a
                            href={imageUrl}
                            download={`${prompt.slice(0, 30).replace(/\s+/g, '_')}.jpeg`}
                            className="absolute bottom-3 right-3 bg-secondary bg-opacity-70 text-white py-1 px-3 rounded-md hover:bg-opacity-100 transition-opacity text-sm"
                        >
                            Download
                        </a>
                    </>
                )}
                {!isLoading && !imageUrl && (
                    <div className="text-center text-text-secondary">
                        <p>Your generated image will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};