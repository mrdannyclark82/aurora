import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { CheckIcon } from './icons/CheckIcon';

export const WorkspaceSwitcher: React.FC = () => {
    const { workspaces, activeWorkspace, switchWorkspace } = useWorkspace();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);
    
    if (!activeWorkspace) return null;

    return (
        <div ref={wrapperRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center p-2 rounded-lg text-left bg-primary hover:bg-border transition-colors"
            >
                <span className="text-xl mr-3">{activeWorkspace.icon}</span>
                <span className="flex-1 text-sm font-semibold truncate">{activeWorkspace.name}</span>
                 <svg className={`w-5 h-5 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.24a.75.75 0 011.06 0l2.7 2.7 2.7-2.7a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0l-3.25-3.25a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute bottom-full mb-1 w-full bg-secondary rounded-lg shadow-lg border border-border z-10">
                    <ul className="p-1">
                        {workspaces.map(ws => (
                            <li key={ws.id}>
                                <button
                                    onClick={() => {
                                        switchWorkspace(ws.id);
                                        setIsOpen(false);
                                    }}
                                    className="w-full flex items-center p-2 text-sm rounded-md text-left text-text-primary hover:bg-primary"
                                >
                                    <span className="text-xl mr-3">{ws.icon}</span>
                                    <span className="flex-1 truncate">{ws.name}</span>
                                    {ws.id === activeWorkspace.id && <CheckIcon className="w-5 h-5 text-accent" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
