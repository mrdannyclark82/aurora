import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Command {
  id: string;
  name: string;
  action: () => void;
  icon?: React.ReactNode;
}

interface CommandPaletteContextType {
  isOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  registerCommand: (command: Command) => void;
  unregisterCommand: (id: string) => void;
  commands: Command[];
}

const CommandPaletteContext = createContext<CommandPaletteContextType | null>(null);

export const CommandPaletteProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [commands, setCommands] = useState<Command[]>([]);

  const openPalette = useCallback(() => setIsOpen(true), []);
  const closePalette = useCallback(() => setIsOpen(false), []);

  const registerCommand = useCallback((command: Command) => {
    setCommands(prev => [...prev.filter(c => c.id !== command.id), command]);
  }, []);
  
  const unregisterCommand = useCallback((id: string) => {
    setCommands(prev => prev.filter(c => c.id !== id));
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, openPalette, closePalette, registerCommand, unregisterCommand, commands }}>
      {children}
    </CommandPaletteContext.Provider>
  );
};

export const useCommandPalette = (): CommandPaletteContextType => {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return context;
};
