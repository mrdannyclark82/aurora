import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Persona, Memory, Agent } from '../types';
import { personas as defaultPersonas } from '../personas';
import { geminiVoices } from '../hooks/useTextToSpeech';
import { useWorkspace } from './WorkspaceContext';

interface SettingsContextType {
    useStreaming: boolean;
    setUseStreaming: (value: boolean) => void;
    autoSpeak: boolean;
    setAutoSpeak: (value: boolean) => void;
    selectedVoice: string;
    setSelectedVoice: (value: string) => void;
    clearAllChatHistory: () => void;
    personas: Persona[];
    addPersona: (persona: Omit<Persona, 'id' | 'custom'>) => void;
    updatePersona: (persona: Persona) => void;
    deletePersona: (id: string) => void;
    memory: Memory[];
    addMemory: (fact: string) => void;
    deleteMemory: (id: string) => void;
    agents: Agent[];
    addAgent: (agent: Omit<Agent, 'id' | 'logs'>) => void;
    updateAgent: (agent: Agent) => void;
    deleteAgent: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const useLocalStorage = <T,>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] => {
    const { activeWorkspace } = useWorkspace();
    const storageKey = activeWorkspace ? `${key}_${activeWorkspace.id}` : key;

    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(storageKey);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });
    
    React.useEffect(() => {
         try {
            const item = window.localStorage.getItem(storageKey);
            setStoredValue(item ? JSON.parse(item) : initialValue);
        } catch (error) {
            console.error(error);
            setStoredValue(initialValue);
        }
    }, [storageKey, initialValue]);

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(storageKey, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue];
};


export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [useStreaming, setUseStreaming] = useLocalStorage('settings_useStreaming', true);
    const [autoSpeak, setAutoSpeak] = useLocalStorage('settings_autoSpeak', false);
    const [selectedVoice, setSelectedVoice] = useLocalStorage('settings_selectedVoice', geminiVoices[0]?.uri || '');
    const [personas, setPersonas] = useLocalStorage<Persona[]>('settings_personas', defaultPersonas);
    const [memory, setMemory] = useLocalStorage<Memory[]>('settings_memory', []);
    const [agents, setAgents] = useLocalStorage<Agent[]>('settings_agents', []);

    const { activeWorkspace } = useWorkspace();

    const clearAllChatHistory = useCallback(() => {
        if (!activeWorkspace) return;
        if (window.confirm(`Are you sure you want to delete all chat history for the "${activeWorkspace.name}" workspace? This cannot be undone.`)) {
            Object.keys(localStorage)
                .filter(key => key.startsWith('chatHistory_') && key.endsWith(`_${activeWorkspace.id}`))
                .forEach(key => localStorage.removeItem(key));
            window.location.reload();
        }
    }, [activeWorkspace]);
    
    const addPersona = (persona: Omit<Persona, 'id' | 'custom'>) => {
        const newPersona: Persona = {
            ...persona,
            id: `custom_${Date.now()}`,
            custom: true
        };
        setPersonas(prev => [...prev, newPersona]);
    };

    const updatePersona = (updatedPersona: Persona) => {
        setPersonas(prev => prev.map(p => p.id === updatedPersona.id ? updatedPersona : p));
    };

    const deletePersona = (id: string) => {
        setPersonas(prev => prev.filter(p => p.id !== id));
        if (activeWorkspace) {
             localStorage.removeItem(`chatHistory_${id}_${activeWorkspace.id}`);
        }
    };
    
    const addMemory = (fact: string) => {
        const newMemory: Memory = { id: `mem_${Date.now()}`, fact };
        setMemory(prev => [...prev, newMemory]);
    };

    const deleteMemory = (id: string) => {
        setMemory(prev => prev.filter(m => m.id !== id));
    };
    
    const addAgent = (agent: Omit<Agent, 'id' | 'logs'>) => {
        const newAgent: Agent = {
            ...agent,
            id: `agent_${Date.now()}`,
            logs: [],
        };
        setAgents(prev => [...prev, newAgent]);
    };

    const updateAgent = (updatedAgent: Agent) => {
        setAgents(prev => prev.map(a => a.id === updatedAgent.id ? updatedAgent : a));
    };
    
    const deleteAgent = (id: string) => {
        setAgents(prev => prev.filter(a => a.id !== id));
    };

    return (
        <SettingsContext.Provider value={{
            useStreaming, setUseStreaming,
            autoSpeak, setAutoSpeak,
            selectedVoice, setSelectedVoice,
            clearAllChatHistory,
            personas, addPersona, updatePersona, deletePersona,
            memory, addMemory, deleteMemory,
            agents, addAgent, updateAgent, deleteAgent,
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = (): SettingsContextType => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
