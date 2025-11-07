import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCommandPalette } from '../contexts/CommandPaletteContext';
import { AppView, ToolCategory } from '../types';
import { tools } from '../tools';
import { SettingsIcon } from './icons/SettingsIcon';
import { GoogleIcon } from './icons/GoogleIcon';
import { useMobileNav } from '../contexts/MobileNavContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

interface SidebarProps {
    activeView: AppView;
    setActiveView: (view: AppView) => void;
}

const NavLink: React.FC<{
    tool: typeof tools[0];
    isActive: boolean;
    onClick: () => void;
}> = ({ tool, isActive, onClick }) => {
    const { user } = useAuth();
    const isDisabled = tool.authRequired && !user;
    return (
        <button
            onClick={onClick}
            disabled={isDisabled}
            className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive ? 'bg-accent text-white' : 'text-text-secondary hover:bg-primary hover:text-text-primary'
            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-current={isActive ? 'page' : undefined}
        >
            <tool.icon className="w-5 h-5 mr-3" />
            <span className="truncate">{tool.name}</span>
        </button>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
    const { user, signIn } = useAuth();
    const { openPalette } = useCommandPalette();
    const { isMobileNavOpen, toggleMobileNav } = useMobileNav();
    const { workspaces } = useWorkspace();

    const handleNav = (view: AppView) => {
        setActiveView(view);
        if (isMobileNavOpen) {
            toggleMobileNav();
        }
    };
    
    const toolCategories = Object.values(ToolCategory);
    
    return (
        <aside className={`absolute md:relative z-30 md:z-auto flex flex-col w-64 bg-secondary border-r border-border transition-transform duration-300 ease-in-out ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
            <div className="flex items-center justify-between p-4 border-b border-border h-16">
                 <div className="flex items-center">
                    <div className="p-1 bg-accent rounded-md">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                    </div>
                    <h1 className="text-xl font-bold text-text-primary ml-2">Aura</h1>
                </div>
            </div>

            {user && workspaces.length > 1 && (
                <div className="p-2 border-b border-border">
                    <WorkspaceSwitcher />
                </div>
            )}
            
            <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
                {toolCategories.map(category => (
                    <div key={category}>
                        <h2 className="px-3 py-1 text-xs font-semibold text-text-secondary uppercase tracking-wider">{category}</h2>
                        <div className="space-y-1 mt-1">
                            {tools.filter(t => t.category === category).map(tool => (
                                <NavLink
                                    key={tool.id}
                                    tool={tool}
                                    isActive={activeView === tool.id}
                                    onClick={() => handleNav(tool.id)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="p-2 border-t border-border">
                <button
                    onClick={openPalette}
                    className="flex items-center w-full px-3 py-2 text-sm font-medium rounded-md text-text-secondary hover:bg-primary hover:text-text-primary"
                >
                    <svg className="w-5 h-5 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" /></svg>
                    <span>Command Palette...</span>
                    <span className="ml-auto text-xs border border-border rounded px-1.5 py-0.5">⌘K</span>
                </button>
            </div>

            <div className="p-4 border-t border-border">
                {user ? (
                    <div className="flex items-center">
                        <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
                        <div className="ml-3 flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{user.name}</p>
                            <p className="text-xs text-text-secondary truncate">{user.email}</p>
                        </div>
                         <div className="group relative">
                             <button onClick={() => handleNav(AppView.SETTINGS)} className="p-1.5 text-text-secondary hover:text-text-primary rounded-md"><SettingsIcon className="w-5 h-5"/></button>
                         </div>
                    </div>
                ) : (
                    <button onClick={signIn} className="w-full flex items-center justify-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-text-primary bg-primary hover:bg-secondary">
                        <GoogleIcon className="w-5 h-5 mr-2" />
                        Sign in with Google
                    </button>
                )}
            </div>
        </aside>
    );
};
