import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GenerateContentResponse } from '@google/genai';
import { generateChatResponse, generateChatResponseStream } from '../services/geminiService';
import { useSettings } from '../contexts/SettingsContext';
import { useError } from '../contexts/ErrorContext';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { ChatMessage, Persona } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { MicIcon } from './icons/MicIcon';
import { SpeakerIcon } from './icons/SpeakerIcon';
import { StopIcon } from './icons/StopIcon';
import { ShareIcon } from './icons/ShareIcon';
import { ExportIcon } from './icons/ExportIcon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fileToBase64 } from '../utils/fileUtils';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { FeedbackButtons } from './FeedbackButtons';

export const ChatView: React.FC = () => {
    const { useStreaming, autoSpeak, personas } = useSettings();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activePersona, setActivePersona] = useState<Persona>(personas[0]);
    const [image, setImage] = useState<{ data: string; mimeType: string; preview: string; } | null>(null);

    const { setError } = useError();
    const { isPlaying, speak, cancel } = useTextToSpeech();
    const { isListening, transcript, toggleListening, setTranscript } = useSpeechRecognition();
    const { toggleMobileNav } = useMobileNav();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (transcript) {
            setInput(transcript);
        }
    }, [transcript]);

    useEffect(() => {
        // Ensure activePersona is always valid, even if the list changes
        if (!personas.find(p => p.id === activePersona.id)) {
            setActivePersona(personas[0] || null);
        }
    }, [personas, activePersona]);

    useEffect(() => {
        if (!activePersona) return;

        const key = `chatHistory_${activePersona.id}`;
        const savedHistory = localStorage.getItem(key);
        if (!savedHistory) {
            setMessages([]);
            return;
        }

        try {
            const initialMessages = JSON.parse(savedHistory);
            if (Array.isArray(initialMessages)) {
                setMessages(initialMessages);
            } else {
                // Corrupted or unexpected shape - clear and fallback
                console.warn(`Saved chat history for ${key} is not an array. Clearing corrupted data.`);
                localStorage.removeItem(key);
                setMessages([]);
            }
        } catch (err) {
            console.error(`Failed to parse saved chat history for ${key}:`, err);
            // Remove the corrupted stored value to avoid repeated failures
            try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
            setMessages([]);
        }
    }, [activePersona]);

    useEffect(() => {
        if (!activePersona) return;
        localStorage.setItem(`chatHistory_${activePersona.id}`, JSON.stringify(messages));
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, activePersona]);

    const handleSendMessage = async () => {
        if (!input.trim() && !image) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            image: image ? { data: image.data, mimeType: image.mimeType } : undefined,
        };
        const currentHistory = [...messages];
        setMessages(prev => [...prev, userMessage]);

        setIsLoading(true);
        setInput('');
        setImage(null);
        setTranscript('');
        if (isListening) toggleListening();
        if (isPlaying) cancel();

        try {
            const messageParts: any[] = [];
            if (input.trim()) {
                messageParts.push({ text: input });
            }
            if (image) {
                messageParts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });
            }

            if (useStreaming) {
                const response = await generateChatResponseStream(currentHistory, { parts: messageParts }, activePersona);

                if (!response.body) throw new Error("Response has no body");

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullResponse = '';
                let responseMessage: ChatMessage | null = null;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunkText = decoder.decode(value);
                    fullResponse += chunkText;
                    if (!responseMessage) {
                        responseMessage = {
                            id: Date.now().toString() + '-model',
                            role: 'model',
                            text: fullResponse,
                            persona: activePersona,
                        };
                        setMessages(prev => [...prev, responseMessage!]);
                    } else {
                        setMessages(prev => prev.map(m => m.id === responseMessage!.id ? { ...m, text: fullResponse } : m));
                    }
                }
                if (autoSpeak && fullResponse) {
                    speak(fullResponse);
                }

            } else {
                const result: GenerateContentResponse = await generateChatResponse(currentHistory, { parts: messageParts }, activePersona);
                const responseText = result.text;
                const modelMessage: ChatMessage = {
                    id: Date.now().toString() + '-model',
                    role: 'model',
                    text: responseText,
                    persona: activePersona,
                };
                setMessages(prev => [...prev, modelMessage]);
                if (autoSpeak && responseText) {
                    speak(responseText);
                }
            }
        } catch (error: any) {
            setError(error.message || "An error occurred while sending the message.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const base64Data = await fileToBase64(file);
                const previewUrl = URL.createObjectURL(file);
                setImage({ data: base64Data, mimeType: file.type, preview: previewUrl });
            } catch (error) {
                setError("Failed to process image.");
            }
        }
    };

    const handleShare = () => {
        try {
            const jsonString = JSON.stringify(messages);
            const encoded = btoa(jsonString);
            const url = `${window.location.origin}${window.location.pathname}#/share/${encoded}`;
            navigator.clipboard.writeText(url);
            alert("Shareable link copied to clipboard!");
        } catch (error) {
            setError("Failed to create shareable link.");
        }
    };

    const handleExport = () => {
        const content = messages.map(m => `**${m.persona?.name || 'You'}**: ${m.text || '(Image attached)'}`).join('\n\n---\n\n');
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `aura-chat-${activePersona.name.toLowerCase()}-${Date.now()}.md`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePersonaChange = (persona: Persona) => {
        if (isLoading || !persona) return;
        setActivePersona(persona);
        setMessages([]);
    };

    if (!activePersona) {
        return <div className="flex h-full w-full items-center justify-center">No personas available. Please add one in Settings.</div>
    }

    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex justify-between items-center">
                <div className="flex items-center">
                    <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                        <MenuIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold">General Chat</h2>
                        <p className="text-sm text-text-secondary">Chat with different AI personas.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleShare} title="Share conversation" className="p-2 rounded-md hover:bg-primary"><ShareIcon className="w-5 h-5" /></button>
                    <button onClick={handleExport} title="Export as Markdown" className="p-2 rounded-md hover:bg-primary"><ExportIcon className="w-5 h-5" /></button>
                </div>
            </header>

            <div className="p-2 bg-primary border-b border-border flex items-center gap-2 overflow-x-auto">
                <span className="text-sm font-medium px-2 shrink-0">Persona:</span>
                {personas.map(p => (
                    <button key={p.id} onClick={() => handlePersonaChange(p)} disabled={isLoading}
                        className={`px-3 py-1 text-sm rounded-full flex items-center gap-2 shrink-0 ${activePersona.id === p.id ? 'bg-accent text-white' : 'bg-secondary hover:bg-border'}`}>
                        <span>{p.avatar}</span>
                        <span>{p.name}</span>
                    </button>
                ))}
            </div>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && <span className="text-2xl pt-1" aria-label={`${msg.persona?.name} persona avatar`}>{msg.persona?.avatar}</span>}
                        <div className="group relative">
                            <div className={`p-3 rounded-2xl max-w-lg ${msg.role === 'user' ? 'bg-accent text-white rounded-br-none' : 'bg-primary rounded-bl-none'}`}>
                                {msg.image && (
                                    <img src={`data:${msg.image.mimeType};base64,${msg.image.data}`} alt="User upload" className="rounded-lg mb-2 max-w-xs max-h-64" />
                                )}
                                <div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text || ''}</ReactMarkdown></div>
                            </div>
                            {msg.role === 'model' && msg.text && (
                                <div className="absolute -bottom-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <FeedbackButtons />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3">
                        <span className="text-2xl pt-1">{activePersona.avatar}</span>
                        <div className="p-3 rounded-2xl max-w-xl bg-primary rounded-bl-none flex items-center">
                            <SpinnerIcon className="w-5 h-5 animate-spin" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>

            <footer className="p-4 border-t border-border bg-secondary">
                <div className="max-w-4xl mx-auto">
                    {image && (
                        <div className="relative w-24 h-24 mb-2 p-1 border border-border rounded-md">
                            <img src={image.preview} alt="upload preview" className="w-full h-full object-cover rounded-sm" />
                            <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">X</button>
                        </div>
                    )}
                    <div className="relative flex items-center">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            placeholder={`Message ${activePersona.name}...`}
                            className="w-full bg-primary border border-border rounded-lg p-3 pr-32 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                            rows={1}
                            disabled={isLoading}
                        />
                        <div className="absolute right-2 flex items-center gap-1">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-md hover:bg-secondary" title="Attach Image"><PaperclipIcon className="w-5 h-5" /></button>
                            <button onClick={toggleListening} className={`p-2 rounded-md hover:bg-secondary ${isListening ? 'text-red-500' : ''}`} title={isListening ? 'Stop listening' : 'Use microphone'}><MicIcon className="w-5 h-5" /></button>
                            <button onClick={isPlaying ? cancel : () => messages.length > 0 && speak(messages[messages.length - 1].text || '')}
                                className="p-2 rounded-md hover:bg-secondary"
                                title={isPlaying ? 'Stop speaking' : 'Speak last message'}>
                                {isPlaying ? <StopIcon className="w-5 h-5" /> : <SpeakerIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};
