import React, { useState, useRef } from 'react';
import { analyzeVideo } from '../services/geminiService';
import { useError } from '../contexts/ErrorContext';
import { fileToBase64 } from '../utils/fileUtils';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { VideoIcon } from './icons/VideoIcon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { FeedbackButtons } from './FeedbackButtons';

export const VideoAnalysisView: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setError } = useError();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toggleMobileNav } = useMobileNav();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        setError("File size exceeds the 50MB limit for browser-based processing. Please select a smaller video.");
        return;
      }
      setVideoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setVideoPreview(previewUrl);
      setAnalysis(null);
      setVideoBase64(null);
      setIsConverting(true);

      try {
        const base64Data = await fileToBase64(file);
        setVideoBase64(base64Data);
      } catch (error) {
        console.error("File to base64 conversion error:", error);
        setError("Failed to process the video file. Please try a different one.");
        setVideoFile(null);
        setVideoPreview(null);
      } finally {
        setIsConverting(false);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!videoBase64 || !prompt.trim() || !videoFile) {
      setError("Please select a video and enter a prompt.");
      return;
    }

    setIsLoading(true);
    setAnalysis(null);

    try {
      const response = await analyzeVideo(prompt, videoBase64, videoFile.type);
      setAnalysis(response.text);
    } catch (error: any) {
      setError(error.message || "Failed to analyze the video.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
      <header className="p-4 border-b border-border flex items-center">
        <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
            <MenuIcon className="w-6 h-6" />
        </button>
        <div>
            <h2 className="text-xl font-bold">Video Analysis</h2>
            <p className="text-sm text-text-secondary">Upload a video and ask questions about it.</p>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <div className="relative w-full aspect-video bg-primary rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
            {videoPreview ? (
              <video src={videoPreview} controls className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-text-secondary p-4">
                <VideoIcon className="w-16 h-16 mx-auto mb-2" />
                <p>Upload a video to get started</p>
              </div>
            )}
          </div>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="hidden"
          />
           <button
            onClick={handleSelectFileClick}
            disabled={isConverting}
            className="w-full bg-primary py-2 px-4 rounded-lg text-text-primary hover:bg-border transition-colors duration-200 truncate flex items-center justify-center disabled:opacity-50"
          >
            {isConverting && <SpinnerIcon className="w-5 h-5 mr-2 animate-spin" />}
            {isConverting ? 'Processing Video...' : (videoFile ? `Selected: ${videoFile.name}` : 'Select Video File')}
          </button>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What do you want to know about this video? (e.g., 'What is happening in this clip?')"
            className="w-full h-24 bg-primary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            disabled={isLoading || isConverting}
          />
          <button
            onClick={handleAnalyze}
            disabled={isLoading || isConverting || !videoBase64 || !prompt.trim()}
            className="w-full p-3 rounded-lg bg-accent text-white disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-blue-500 transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <SpinnerIcon className="w-5 h-5 mr-2 animate-spin-slow" />
                Analyzing...
              </div>
            ) : (
              'Analyze Video'
            )}
          </button>
        </div>

        <div className="bg-primary rounded-lg p-4 h-full overflow-y-auto flex flex-col relative group">
          <h3 className="text-lg font-semibold mb-2">Analysis Result</h3>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <SpinnerIcon className="w-8 h-8 animate-spin-slow text-accent" />
              </div>
            ) : analysis ? (
              <div className="markdown-content text-text-secondary">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-text-secondary italic">The analysis of the video will appear here once you submit your request.</p>
            )}
          </div>
          {analysis && !isLoading && (
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <FeedbackButtons />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};