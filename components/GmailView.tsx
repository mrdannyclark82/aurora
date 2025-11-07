import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useError } from '../contexts/ErrorContext';
import { GmailIcon } from './icons/GmailIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { fetchUnreadGmailMessages } from '../services/googleApiService';
import { generateContentWithTools } from '../services/geminiService';
import { FunctionDeclaration, Tool, Type, Content, Part } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { FeedbackButtons } from './FeedbackButtons';

const get_recent_emails_tool: FunctionDeclaration = {
  name: 'get_recent_emails',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
  description: 'Retrieves the 5 most recent unread emails from the user\'s Gmail account.',
};

const tools: Tool[] = [{ functionDeclarations: [get_recent_emails_tool] }];

const GmailSkeleton: React.FC = () => (
    <div className="bg-primary p-6 rounded-lg animate-pulse">
        <div className="h-6 w-1/3 bg-secondary rounded-md mb-6"></div>
        <div className="space-y-4">
            <div className="h-4 w-full bg-secondary rounded-md"></div>
            <div className="h-4 w-5/6 bg-secondary rounded-md"></div>
            <div className="h-4 w-full bg-secondary rounded-md"></div>
            <div className="h-4 w-1/2 bg-secondary rounded-md"></div>
        </div>
        <div className="h-9 w-32 bg-secondary rounded-md mt-8"></div>
    </div>
);


export const GmailView: React.FC = () => {
    const { accessToken } = useAuth();
    const { setError } = useError();
    const [isLoading, setIsLoading] = useState(false);
    const [summary, setSummary] = useState<string | null>(null);
    const { toggleMobileNav } = useMobileNav();

    const handleSummarize = async () => {
        if (!accessToken) {
            setError("Authentication token is missing. Please sign in again.");
            return;
        }

        setIsLoading(true);
        setSummary(null);

        try {
            const prompt = "Please summarize my 5 most recent unread emails.";
            // FIX: Pass a valid Content[] array to the updated generateContentWithTools function.
            const conversationHistory: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
            const modelResponse = await generateContentWithTools(conversationHistory, tools);
            
            const functionCalls = modelResponse.functionCalls;
            
            if (functionCalls && functionCalls[0].name === 'get_recent_emails') {
                const emails = await fetchUnreadGmailMessages(accessToken);

                if (emails.length === 0) {
                    setSummary("You have no unread emails. Inbox zero!");
                    setIsLoading(false);
                    return;
                }
                
                // FIX: Construct a valid FunctionResponsePart and continue the conversation history.
                conversationHistory.push(modelResponse.candidates![0].content);
                const functionResponsePart: Part = {
                    functionResponse: {
                        name: functionCalls[0].name,
                        response: {
                           emails: emails.map(e => ({ from: e.from, subject: e.subject, snippet: e.snippet })),
                        }
                    }
                };
                conversationHistory.push({ role: 'user', parts: [functionResponsePart] });

                const finalResponse = await generateContentWithTools(conversationHistory, tools);
                setSummary(finalResponse.text);

            } else {
                 setSummary(modelResponse.text);
            }

        } catch (error: any) {
            console.error(error);
            setError(error.message || 'An error occurred while summarizing emails.');
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
                    <h2 className="text-xl font-bold">Gmail Assistant</h2>
                    <p className="text-sm text-text-secondary">Let Aura summarize your unread emails.</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                    {!summary && !isLoading && (
                        <div className="text-center mt-16 animate-fade-in p-4">
                            <GmailIcon className="w-16 h-16 mx-auto text-text-secondary" />
                            <h3 className="mt-4 text-xl font-semibold">Stay on top of your inbox</h3>
                            <p className="mt-2 text-text-secondary">Click the button to fetch and summarize your latest unread emails.</p>
                             <button
                                onClick={handleSummarize}
                                disabled={isLoading}
                                className="mt-6 px-6 py-3 bg-accent text-white rounded-lg disabled:opacity-50 hover:bg-blue-500 transition-colors"
                            >
                                Summarize My Emails
                            </button>
                        </div>
                    )}
                    
                    {isLoading && <GmailSkeleton />}

                    {summary && !isLoading && (
                         <div className="bg-primary p-6 rounded-lg animate-fade-in relative group">
                            <h3 className="text-lg font-semibold mb-4">Your Email Summary:</h3>
                            <div className="markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                            </div>
                            <div className="flex items-center justify-between mt-6">
                                <button
                                    onClick={handleSummarize}
                                    disabled={isLoading}
                                    className="px-5 py-2 border border-border text-sm font-medium rounded-lg hover:bg-border transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? 'Refreshing...' : 'Refresh Summary'}
                                </button>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <FeedbackButtons />
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};