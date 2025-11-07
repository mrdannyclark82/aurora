import React, { useState, useEffect, useRef } from 'react';
import { useCommandPalette } from '../contexts/CommandPaletteContext';

export const CommandPalette: React.FC = () => {
    const { isOpen, closePalette, commands } = useCommandPalette();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredCommands = commands.filter(cmd =>
        cmd.name.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
        } else {
            setQuery('');
        }
    }, [isOpen]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'Escape') {
                closePalette();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % (filteredCommands.length || 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + (filteredCommands.length || 1)) % (filteredCommands.length || 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const command = filteredCommands[selectedIndex];
                if (command) {
                    command.action();
                    closePalette();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, closePalette, filteredCommands, selectedIndex]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black bg-opacity-50" onClick={closePalette}>
            <div
                className="w-full max-w-lg bg-secondary rounded-lg shadow-xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Type a command or search..."
                    className="w-full p-4 bg-primary border-b border-border text-text-primary focus:outline-none"
                />
                <ul className="max-h-96 overflow-y-auto">
                    {filteredCommands.length > 0 ? (
                        filteredCommands.map((cmd, index) => (
                            <li
                                key={cmd.id}
                                onMouseEnter={() => setSelectedIndex(index)}
                                onClick={() => {
                                    cmd.action();
                                    closePalette();
                                }}
                                className={`flex items-center px-4 py-3 cursor-pointer ${
                                    index === selectedIndex ? 'bg-accent text-white' : 'text-text-secondary hover:bg-primary hover:text-text-primary'
                                }`}
                            >
                                {cmd.icon && <span className="w-6 h-6 mr-3">{cmd.icon}</span>}
                                <span>{cmd.name}</span>
                            </li>
                        ))
                    ) : (
                        <li className="px-4 py-6 text-center text-text-secondary">No commands found.</li>
                    )}
                </ul>
            </div>
        </div>
    );
};
