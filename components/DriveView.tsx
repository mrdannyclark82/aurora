import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useError } from '../contexts/ErrorContext';
import { DriveIcon } from './icons/DriveIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { searchDriveFiles, getDriveFileContent } from '../services/googleApiService';
import { generateContentWithTools } from '../services/geminiService';
import { FunctionDeclaration, Tool, Type, Part, Content, GenerateContentResponse } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { FeedbackButtons } from './FeedbackButtons';

const search_drive_files_tool: FunctionDeclaration = {
  name: 'search_drive_files',
  description: 'Searches the user\'s Google Drive for files matching a query.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'The search term to find files.' },
    },
    required: ['query'],
  },
};

const get_drive_file_content_tool: FunctionDeclaration = {
  name: 'get_drive_file_content',
  description: 'Retrieves the text content of a specific file from Google Drive using its ID.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      fileId: { type: Type.STRING, description: 'The unique ID of the file.' },
      mimeType: { type: Type.STRING, description: 'The MIME type of the file.' },
    },
    required: ['fileId', 'mimeType'],
  },
};

const tools: Tool[] = [{ functionDeclarations: [search_drive_files_tool, get_drive_file_content_tool] }];

export const DriveView: React.FC = () => {
    const { accessToken } = useAuth();
    const { setError } = useError();
    const [isLoading, setIsLoading] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [result, setResult] = useState<string | null>(null);
    const [status, setStatus] = useState('');
    const { toggleMobileNav } = useMobileNav();
    const conversationHistoryRef = useRef<Content[]>([]);

    const handleAnalyze = async () => {
        if (!accessToken || !prompt.trim()) return;

        setIsLoading(true);
        setResult(null);
        setStatus('Thinking...');
        conversationHistoryRef.current = [];

        try {
            // FIX: The entire multi-turn logic was flawed. It now correctly builds a conversation history.
            const userContent: Content = { role: 'user', parts: [{ text: prompt }] };
            conversationHistoryRef.current.push(userContent);
            
            let modelResponse: GenerateContentResponse = await generateContentWithTools(conversationHistoryRef.current, tools);
            
            while (modelResponse.functionCalls && modelResponse.functionCalls.length > 0) {
                 conversationHistoryRef.current.push(modelResponse.candidates![0].content);
                 const functionCalls = modelResponse.functionCalls;
                 const functionResponseParts: Part[] = [];

                for (const call of functionCalls) {
                     let callResult: any;
                    if (call.name === 'search_drive_files') {
                        setStatus(`Searching Drive for "${call.args.query}"...`);
                        callResult = await searchDriveFiles(accessToken, call.args.query);
                    } else if (call.name === 'get_drive_file_content') {
                        setStatus(`Reading file content...`);
                        callResult = await getDriveFileContent(accessToken, call.args.fileId, call.args.mimeType);
                    }
                    // FIX: Construct a valid FunctionResponsePart
                    functionResponseParts.push({ functionResponse: { name: call.name, response: { result: callResult } }});
                }
                
                conversationHistoryRef.current.push({ role: 'user', parts: functionResponseParts });
                setStatus('Analyzing content...');
                modelResponse = await generateContentWithTools(conversationHistoryRef.current, tools);
            }

            setResult(modelResponse.text);

        } catch (error: any) {
            setError(error.message || 'An error occurred while interacting with Google Drive.');
        } finally {
            setIsLoading(false);
            setStatus('');
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">Drive Assistant</h2>
                    <p className="text-sm text-text-secondary">Ask questions about your files in Google Drive.</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col gap-4 mb-6">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., Summarize my document titled 'Q3 Marketing Strategy'"
                            className="w-full flex-grow bg-primary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                            rows={3}
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleAnalyze}
                            disabled={isLoading || !prompt.trim()}
                            className="w-full p-3 rounded-lg bg-accent text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
                        >
                            {isLoading ? <SpinnerIcon className="w-5 h-5 mx-auto animate-spin" /> : 'Analyze'}
                        </button>
                    </div>

                    {isLoading && (
                        <div className="text-center text-text-secondary">
                             <SpinnerIcon className="w-8 h-8 mx-auto animate-spin text-accent" />
                             <p className="mt-2 text-sm">{status || 'Processing...'}</p>
                        </div>
                    )}
                    
                    {result && !isLoading && (
                        <div className="bg-primary p-6 rounded-lg animate-fade-in border border-border relative group">
                            <h3 className="text-lg font-semibold mb-4">Analysis Result:</h3>
                            <div className="markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                            </div>
                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <FeedbackButtons />
                            </div>
                        </div>
                    )}

                    {!result && !isLoading && (
                         <div className="text-center mt-16 text-text-secondary p-4">
                            <DriveIcon className="w-16 h-16 mx-auto" />
                            <h3 className="mt-4 text-xl font-semibold">Your Personal Knowledge Base</h3>
                            <p className="mt-2 max-w-md mx-auto">
                                Aura can find, read, and summarize your Google Docs and text files.
                                Try asking it to find a specific document and give you the key points.
                            </p>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};