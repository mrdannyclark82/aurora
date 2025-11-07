
import React, { useState, useMemo, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { proposeUpdate } from '../services/geminiService';
import { CodeBracketsIcon } from './icons/CodeBracketsIcon';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// @ts-ignore
import { createTwoFilesPatch } from 'diff';
import { parsePatch, Diff } from 'react-diff-view';
import 'react-diff-view/style/index.css';


// --- VIRTUAL FILE SYSTEM ---
// In a real environment with a build server, we could read this dynamically.
// For this browser-based simulation, we'll manually include the file contents.
const files: Record<string, string> = {
    // This map would be populated with the full content of every file in the project.
    // For brevity in this response, I'll only include a few key files to demonstrate the concept.
    // In a real implementation, a build script would generate this map.
    
    '/App.tsx': `import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorProvider } from './contexts/ErrorContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { CommandPaletteProvider, useCommandPalette } from './contexts/CommandPaletteContext';
import { MobileNavProvider, useMobileNav } from './contexts/MobileNavContext';
import { ErrorToast } from './components/ErrorToast';
import { Sidebar } from './components/Sidebar';
import { AppView, ChatMessage } from './types';
import { CommandPalette } from './components/CommandPalette';
import { personas } from './personas';
import { ViewLoader } from './components/ViewLoader';
import { tools } from './tools';
import { ChangelogModal } from './components/ChangelogModal';

// Lazy load the shared view separately as it's not a main "tool"
const SharedChatView = lazy(() => import('./components/SharedChatView').then(module => ({ default: module.SharedChatView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(module => ({ default: module.SettingsView })));


const App: React.FC = () => {
    const [sharedMessages, setSharedMessages] = React.useState<ChatMessage[] | null>(null);

    React.useEffect(() => {
        const handleHashChange = () => {
            if (window.location.hash.startsWith('#/share/')) {
                try {
                    const encoded = window.location.hash.substring(8);
                    const jsonString = atob(encoded);
                    const messages = JSON.parse(jsonString);
                    setSharedMessages(messages);
                } catch (error) {
                    console.error("Failed to decode shared chat:", error);
                    window.location.hash = '';
                }
            } else {
                setSharedMessages(null);
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    if (sharedMessages) {
        return (
            <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-primary"><ViewLoader /></div>}>
                <SharedChatView messages={sharedMessages} />
            </Suspense>
        );
    }

    // Note: The main app providers are now in index.tsx
    return <MainApp />;
};

const MainApp: React.FC = () => {
    const [activeView, setActiveView] = useState<AppView>(AppView.DASHBOARD);
    const { registerCommand } = useCommandPalette();
    const { user, signOut } = useAuth();
    const { clearAllChatHistory } = useSettings();
    const { isMobileNavOpen, toggleMobileNav } = useMobileNav();

     useEffect(() => {
        // Dynamically register navigation commands from the tool registry
        tools.forEach(tool => {
            registerCommand({
                id: \`nav-\${tool.id}\`,
                name: \`Go to \${tool.name}\`,
                action: () => setActiveView(tool.id),
                icon: <tool.icon />
            });
        });
        
        // Register persona-specific commands
        personas.forEach(p => {
            registerCommand({
                id: \`chat-\${p.id}\`,
                name: \`New Chat with \${p.name}\`,
                action: () => {
                    localStorage.removeItem(\`chatHistory_\${p.id}\`);
                    setActiveView(AppView.CHAT);
                    window.location.reload(); 
                },
                icon: <span>{p.avatar}</span>
            });
        });

        // Register static commands
        if(user) {
            registerCommand({ id: 'auth-signout', name: 'Sign Out', action: signOut });
        }
        registerCommand({ id: 'settings-clear-history', name: 'Clear All Chat History', action: clearAllChatHistory });

    }, [registerCommand, user, signOut, clearAllChatHistory]);

    const renderView = () => {
        if (activeView === AppView.SETTINGS) {
            return <SettingsView />;
        }
        const activeTool = tools.find(t => t.id === activeView);
        const Component = activeTool 
            ? activeTool.component 
            : tools.find(t => t.id === AppView.DASHBOARD)!.component;
        return <Component />;
    };

    return (
        <div className="flex h-screen bg-secondary font-sans overflow-hidden">
            <Sidebar activeView={activeView} setActiveView={setActiveView} />
            {isMobileNavOpen && (
                <div 
                    onClick={toggleMobileNav}
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
                    aria-hidden="true"
                />
            )}
            <main className={\`flex-1 flex flex-col transition-all duration-300 ease-in-out \${isMobileNavOpen ? 'blur-sm pointer-events-none md:blur-none md:pointer-events-auto' : ''}\`}>
                <Suspense fallback={<ViewLoader />}>
                    {renderView()}
                </Suspense>
            </main>
            <ErrorToast />
            <CommandPalette />
            <ChangelogModal />
        </div>
    );
};

export default App;`,
    '/components/ChatView.tsx': `import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useWorkspace } from '../contexts/WorkspaceContext';

export const ChatView: React.FC = () => {
    const { useStreaming, autoSpeak, personas } = useSettings();
    const { activeWorkspace } = useWorkspace();
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

    const getHistoryKey = useCallback(() => {
        if (!activePersona || !activeWorkspace) return null;
        return \`chatHistory_\${activePersona.id}_\${activeWorkspace.id}\`;
    }, [activePersona, activeWorkspace]);

    useEffect(() => {
        const historyKey = getHistoryKey();
        if (!historyKey) return;
        
        const savedHistory = localStorage.getItem(historyKey);
        const initialMessages = savedHistory ? JSON.parse(savedHistory) : [];
        setMessages(initialMessages);
    }, [activePersona, activeWorkspace, getHistoryKey]);

    useEffect(() => {
        const historyKey = getHistoryKey();
        if (!historyKey) return;

        localStorage.setItem(historyKey, JSON.stringify(messages));
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, getHistoryKey]);

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
                messageParts.push({ inlineData: { data: image.data, mimeType: image.mimeType }});
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
            const url = \`\${window.location.origin}\${window.location.pathname}#/share/\${encoded}\`;
            navigator.clipboard.writeText(url);
            alert("Shareable link copied to clipboard!");
        } catch (error) {
            setError("Failed to create shareable link.");
        }
    };

    const handleExport = () => {
        const content = messages.map(m => \`**\${m.persona?.name || 'You'}**: \${m.text || '(Image attached)'}\`).join('\\n\\n---\\n\\n');
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", \`aura-chat-\${activePersona.name.toLowerCase()}-\${Date.now()}.md\`);
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
                    <button onClick={handleShare} title="Share conversation" className="p-2 rounded-md hover:bg-primary"><ShareIcon className="w-5 h-5"/></button>
                    <button onClick={handleExport} title="Export as Markdown" className="p-2 rounded-md hover:bg-primary"><ExportIcon className="w-5 h-5"/></button>
                </div>
            </header>
            
            <div className="p-2 bg-primary border-b border-border flex items-center gap-2 overflow-x-auto">
                <span className="text-sm font-medium px-2 shrink-0">Persona:</span>
                {personas.map(p => (
                    <button key={p.id} onClick={() => handlePersonaChange(p)} disabled={isLoading}
                        className={\`px-3 py-1 text-sm rounded-full flex items-center gap-2 shrink-0 \${activePersona.id === p.id ? 'bg-accent text-white' : 'bg-secondary hover:bg-border'}\`}>
                        <span>{p.avatar}</span>
                        <span>{p.name}</span>
                    </button>
                ))}
            </div>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={\`flex items-start gap-3 \${msg.role === 'user' ? 'justify-end' : ''}\`}>
                        {msg.role === 'model' && <span className="text-2xl pt-1" aria-label={\`\${msg.persona?.name} persona avatar\`}>{msg.persona?.avatar}</span>}
                        <div className="group relative">
                            <div className={\`p-3 rounded-2xl max-w-lg \${msg.role === 'user' ? 'bg-accent text-white rounded-br-none' : 'bg-primary rounded-bl-none'}\`}>
                                {msg.image && (
                                    <img src={\`data:\${msg.image.mimeType};base64,\${msg.image.data}\`} alt="User upload" className="rounded-lg mb-2 max-w-xs max-h-64" />
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
                            <img src={image.preview} alt="upload preview" className="w-full h-full object-cover rounded-sm"/>
                            <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">X</button>
                        </div>
                    )}
                    <div className="relative flex items-center">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            placeholder={\`Message \${activePersona.name}...\`}
                            className="w-full bg-primary border border-border rounded-lg p-3 pr-32 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                            rows={1}
                            disabled={isLoading}
                        />
                        <div className="absolute right-2 flex items-center gap-1">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden"/>
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-md hover:bg-secondary" title="Attach Image"><PaperclipIcon className="w-5 h-5"/></button>
                            <button onClick={toggleListening} className={\`p-2 rounded-md hover:bg-secondary \${isListening ? 'text-red-500' : ''}\`} title={isListening ? 'Stop listening' : 'Use microphone'}><MicIcon className="w-5 h-5"/></button>
                             <button onClick={isPlaying ? cancel : () => messages.length > 0 && speak(messages[messages.length - 1].text || '')} 
                                className="p-2 rounded-md hover:bg-secondary" 
                                title={isPlaying ? 'Stop speaking' : 'Speak last message'}>
                                {isPlaying ? <StopIcon className="w-5 h-5"/> : <SpeakerIcon className="w-5 h-5"/>}
                             </button>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};`,
     '/tools.ts': `import { lazy } from 'react';
import { ToolDefinition, AppView, ToolCategory } from './types';

// Icons
import { HomeIcon } from './components/icons/HomeIcon';
import { ChatIcon } from './components/icons/ChatIcon';
import { SearchIcon } from './components/icons/SearchIcon';
import { MapIcon } from './components/icons/MapIcon';
import { MicIcon } from './components/icons/MicIcon';
import { GmailIcon } from './components/icons/GmailIcon';
import { CalendarIcon } from './components/icons/CalendarIcon';
import { DriveIcon } from './components/icons/DriveIcon';
import { PlaneIcon } from './components/icons/PlaneIcon';
import { VideoIcon } from './components/icons/VideoIcon';
import { FilmIcon } from './components/icons/FilmIcon';
import { ToolboxIcon } from './components/icons/ToolboxIcon';
import { CpuChipIcon } from './components/icons/CpuChipIcon';
import { YouTubeIcon } from './components/icons/YouTubeIcon';
import { CodeBracketsIcon } from './components/icons/CodeBracketsIcon';

export const tools: ToolDefinition[] = [
    {
        id: AppView.DASHBOARD,
        name: 'Dashboard',
        component: lazy(() => import('./components/DashboardView').then(module => ({ default: module.DashboardView }))),
        icon: HomeIcon,
        category: ToolCategory.MAIN,
        authRequired: true,
    },
    {
        id: AppView.CHAT,
        name: 'General Chat',
        component: lazy(() => import('./components/ChatView').then(module => ({ default: module.ChatView }))),
        icon: ChatIcon,
        category: ToolCategory.MAIN,
        authRequired: false,
    },
    {
        id: AppView.TOOLKIT,
        name: 'Toolkit',
        component: lazy(() => import('./components/ToolkitView').then(module => ({ default: module.ToolkitView }))),
        icon: ToolboxIcon,
        category: ToolCategory.MAIN,
        authRequired: false,
    },
    {
        id: AppView.SEARCH,
        name: 'Web Search',
        component: lazy(() => import('./components/SearchView').then(module => ({ default: module.SearchView }))),
        icon: SearchIcon,
        category: ToolCategory.INTEGRATIONS,
        authRequired: false,
    },
    {
        id: AppView.MAPS,
        name: 'Local Guide',
        component: lazy(() => import('./components/MapsView').then(module => ({ default: module.MapsView }))),
        icon: MapIcon,
        category: ToolCategory.INTEGRATIONS,
        authRequired: false,
    },
    {
        id: AppView.GMAIL,
        name: 'Gmail',
        component: lazy(() => import('./components/GmailView').then(module => ({ default: module.GmailView }))),
        icon: GmailIcon,
        category: ToolCategory.INTEGRATIONS,
        authRequired: true,
    },
    {
        id: AppView.CALENDAR,
        name: 'Calendar',
        component: lazy(() => import('./components/CalendarView').then(module => ({ default: module.CalendarView }))),
        icon: CalendarIcon,
        category: ToolCategory.INTEGRATIONS,
        authRequired: true,
    },
    {
        id: AppView.DRIVE,
        name: 'Drive',
        component: lazy(() => import('./components/DriveView').then(module => ({ default: module.DriveView }))),
        icon: DriveIcon,
        category: ToolCategory.INTEGRATIONS,
        authRequired: true,
    },
    {
        id: AppView.LIVE,
        name: 'Live Conversation',
        component: lazy(() => import('./components/LiveView').then(module => ({ default: module.LiveView }))),
        icon: MicIcon,
        category: ToolCategory.MEDIA,
        authRequired: false,
    },
    {
        id: AppView.VIDEO_ANALYSIS,
        name: 'Video Analysis',
        component: lazy(() => import('./components/VideoAnalysisView').then(module => ({ default: module.VideoAnalysisView }))),
        icon: VideoIcon,
        category: ToolCategory.MEDIA,
        authRequired: false,
    },
    {
        id: AppView.VIDEO_GENERATION,
        name: 'Video Generation',
        component: lazy(() => import('./components/VideoGenerationView').then(module => ({ default: module.VideoGenerationView }))),
        icon: FilmIcon,
        category: ToolCategory.MEDIA,
        authRequired: false,
    },
    {
        id: AppView.YOUTUBE,
        name: 'YouTube Studio',
        component: lazy(() => import('./components/YouTubeView').then(module => ({ default: module.YouTubeView }))),
        icon: YouTubeIcon,
        category: ToolCategory.MEDIA,
        authRequired: false,
    },
    {
        id: AppView.TRIP_PLANNER,
        name: 'Trip Planner',
        component: lazy(() => import('./components/TripPlannerView').then(module => ({ default: module.TripPlannerView }))),
        icon: PlaneIcon,
        category: ToolCategory.EXPERIMENTAL,
        authRequired: true,
    },
    {
        id: AppView.AGENTS,
        name: 'Background Agents',
        component: lazy(() => import('./components/AgentsView').then(module => ({ default: module.AgentsView }))),
        icon: CpuChipIcon,
        category: ToolCategory.EXPERIMENTAL,
        authRequired: true,
    },
    {
        id: AppView.UPDATER,
        name: 'Aura Updater',
        component: lazy(() => import('./components/UpdaterView').then(module => ({ default: module.UpdaterView }))),
        icon: CodeBracketsIcon,
        category: ToolCategory.EXPERIMENTAL,
        authRequired: false,
    }
];`,
};
// --- END VFS ---

const loadingMessages = [
    "Analyzing your request...",
    "Reading the application's source code...",
    "Formulating an implementation plan...",
    "Writing new code...",
    "Double-checking the proposed changes...",
    "This is a complex task, thanks for your patience...",
];

interface ProposedChange {
    file: string;
    description: string;
    content: string;
}

interface UpdateProposal {
    plan: string;
    changes: ProposedChange[];
}

export const UpdaterView: React.FC = () => {
    const { setError } = useError();
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
    const [proposal, setProposal] = useState<UpdateProposal | null>(null);
    const [isApplied, setIsApplied] = useState(false);
    const { toggleMobileNav } = useMobileNav();

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

    const handleProposeUpdate = async () => {
        if (!prompt.trim()) {
            setError("Please describe the feature or change you want to make.");
            return;
        }
        setIsLoading(true);
        setProposal(null);
        setIsApplied(false);
        setLoadingMessage(loadingMessages[0]);
        try {
            const response = await proposeUpdate(prompt, files);
            if (!response.plan || !response.changes) {
                throw new Error("The AI returned an invalid response structure. Please try rephrasing your request.");
            }
            setProposal(response);
        } catch (error: any) {
            setError(error.message || "Failed to generate an update proposal.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        setIsApplied(true);
    };

    const handleReset = () => {
        setPrompt('');
        setProposal(null);
        setIsApplied(false);
    };

    const diffs = useMemo(() => {
        if (!proposal) return [];
        return proposal.changes.map(change => {
            const oldContent = files[change.file] || '';
            const patch = createTwoFilesPatch(change.file, change.file, oldContent, change.content, '', '', { context: 3 });
            return {
                ...change,
                parsed: parsePatch(patch)
            }
        });
    }, [proposal]);

    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">Aura Updater</h2>
                    <p className="text-sm text-text-secondary">Let Aura update its own code to add new features.</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                    {isLoading ? (
                        <div className="text-center text-text-secondary py-20">
                             <SpinnerIcon className="w-12 h-12 mx-auto animate-spin text-accent" />
                             <p className="mt-4 text-lg font-semibold">{loadingMessage}</p>
                             <p className="text-sm mt-1">Aura is thinking and writing code...</p>
                        </div>
                    ) : proposal ? (
                        <div className="animate-fade-in">
                            <div className="bg-primary p-4 rounded-lg border border-border">
                                <h3 className="text-lg font-semibold mb-2">Implementation Plan</h3>
                                <div className="markdown-content text-sm">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{proposal.plan}</ReactMarkdown>
                                </div>
                            </div>
                            <h3 className="text-lg font-semibold my-4">Proposed Code Changes:</h3>
                            <div className="space-y-4">
                                {diffs.map((diff, i) => (
                                    <div key={i} className="border border-border rounded-lg overflow-hidden">
                                        <div className="bg-primary p-2 px-4 text-sm font-mono text-text-secondary border-b border-border">{diff.file}</div>
                                        <Diff viewType="split" diffType="modify" hunks={diff.parsed[0]?.hunks || []} />
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 flex items-center justify-between p-4 bg-primary rounded-lg border border-border">
                                {isApplied ? (
                                    <p className="text-green-400 font-semibold">✅ Update applied! (Simulated)</p>
                                ) : (
                                    <p className="text-sm text-text-secondary">Review the changes and apply them if they look correct.</p>
                                )}
                                <div className="flex gap-3">
                                    <button onClick={handleReset} className="px-4 py-2 bg-secondary text-text-primary rounded-lg hover:bg-border">Start Over</button>
                                    <button onClick={handleApply} disabled={isApplied} className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
                                        {isApplied ? 'Applied' : 'Apply Update (Simulated)'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="text-center my-8 text-text-secondary">
                                <CodeBracketsIcon className="w-16 h-16 mx-auto" />
                                <h3 className="mt-4 text-xl font-semibold">Self-Evolving Codebase</h3>
                                <p className="mt-2 max-w-lg mx-auto">
                                    Describe a new feature or a change you want to see in Aura. The AI will analyze its own source code and propose the necessary changes to implement it.
                                </p>
                            </div>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g., Add a button to the Chat view that clears the conversation history."
                                className="w-full h-24 bg-primary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                            />
                            <button
                                onClick={handleProposeUpdate}
                                disabled={!prompt.trim()}
                                className="w-full p-3 rounded-lg bg-accent text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
                            >
                                Propose Update
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
