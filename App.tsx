import React, { useState, useEffect, Suspense, lazy } from 'react';
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
                id: `nav-${tool.id}`,
                name: `Go to ${tool.name}`,
                action: () => setActiveView(tool.id),
                icon: <tool.icon />
            });
        });
        
        // Register persona-specific commands
        personas.forEach(p => {
            registerCommand({
                id: `chat-${p.id}`,
                name: `New Chat with ${p.name}`,
                action: () => {
                    localStorage.removeItem(`chatHistory_${p.id}`);
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
            <main className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${isMobileNavOpen ? 'blur-sm pointer-events-none md:blur-none md:pointer-events-auto' : ''}`}>
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

export default App;