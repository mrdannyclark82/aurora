import React from 'react';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SharedChatViewProps {
    messages: ChatMessage[];
}

export const SharedChatView: React.FC<SharedChatViewProps> = ({ messages }) => {
    return (
        <div className="bg-secondary text-text-primary min-h-screen">
            <header className="p-4 bg-primary border-b border-border flex flex-wrap justify-between items-center sticky top-0 z-10 gap-2">
                 <div className="flex items-center">
                    <div className="p-2 bg-accent rounded-full">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                    </div>
                    <h1 className="text-xl font-bold text-text-primary ml-3">Aura AI</h1>
                </div>
                 <a href="/" className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-blue-500 transition-colors">
                    Return to Aura
                </a>
            </header>
            <main className="p-4 md:p-6 max-w-4xl mx-auto">
                 <h2 className="text-2xl font-bold text-center mb-2">Shared Conversation</h2>
                 <p className="text-sm text-text-secondary text-center mb-8">This is a read-only view of a shared conversation.</p>
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'model' && <span className="text-2xl" aria-label={`${msg.persona?.name} persona avatar`}>{msg.persona?.avatar}</span>}
                            <div className={`p-3 rounded-2xl max-w-xl ${msg.role === 'user' ? 'bg-accent text-white rounded-br-none' : 'bg-primary rounded-bl-none'}`}>
                                {msg.image && (
                                    <img 
                                        src={`data:${msg.image.mimeType};base64,${msg.image.data}`}
                                        alt="User upload"
                                        className="rounded-lg mb-2 max-w-xs max-h-64"
                                    />
                                )}
                                {/* Fix: Wrap ReactMarkdown in a div to apply className, resolving a TypeScript type error where className was not a recognized prop. */}
                                <div className="markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {msg.text || ''}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};