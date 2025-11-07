import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { Persona } from '../types';
import { UserCircleIcon } from './icons/UserCircleIcon';
import { PlusIcon } from './icons/PlusIcon';
import { EditIcon } from './icons/EditIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import { MemoryIcon } from './icons/MemoryIcon';
import { BellIcon } from './icons/BellIcon';
import { useNotifications } from '../contexts/NotificationContext';

const PersonaForm: React.FC<{ persona?: Persona, onSave: (persona: Persona) => void, onCancel: () => void }> = ({ persona, onSave, onCancel }) => {
    const [name, setName] = useState(persona?.name || '');
    const [avatar, setAvatar] = useState(persona?.avatar || '');
    const [prompt, setPrompt] = useState(persona?.prompt || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !prompt.trim()) {
            alert("Name and Prompt are required.");
            return;
        }
        onSave({
            ...persona,
            id: persona?.id || '', // id is handled by the context for new personas
            name,
            avatar,
            prompt,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
            <div className="bg-secondary p-6 rounded-lg shadow-xl w-full max-w-lg m-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{persona ? 'Edit' : 'Create'} Persona</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <label htmlFor="avatar" className="block text-sm font-medium mb-1">Avatar (Emoji)</label>
                            <input id="avatar" type="text" value={avatar} onChange={e => setAvatar(e.target.value)}
                                className="w-20 text-center text-4xl bg-primary border border-border rounded-lg p-2" maxLength={2} />
                        </div>
                        <div className="flex-1">
                            <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
                            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)}
                                className="w-full bg-primary border border-border rounded-lg p-2 text-text-primary" required />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="prompt" className="block text-sm font-medium mb-1">System Prompt</label>
                        <textarea id="prompt" value={prompt} onChange={e => setPrompt(e.target.value)}
                            className="w-full h-40 bg-primary border border-border rounded-lg p-2 text-text-primary resize-none"
                            placeholder="e.g., You are a helpful assistant who speaks like a pirate." required />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onCancel} className="px-4 py-2 bg-primary hover:bg-border rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-500">Save Persona</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


export const SettingsView: React.FC = () => {
    const {
        useStreaming, setUseStreaming, autoSpeak, setAutoSpeak,
        selectedVoice, setSelectedVoice, clearAllChatHistory,
        personas, addPersona, updatePersona, deletePersona,
        memory, addMemory, deleteMemory
    } = useSettings();
    const { voices, speak, isPlaying } = useTextToSpeech();
    const { toggleMobileNav } = useMobileNav();
    const { permission, requestPermission } = useNotifications();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPersona, setEditingPersona] = useState<Persona | undefined>(undefined);
    const [newMemory, setNewMemory] = useState('');

    const handleTestVoice = () => {
        if (selectedVoice) {
            const voiceName = voices.find(v => v.uri === selectedVoice)?.name || 'selected';
            speak(`This is a test of the ${voiceName} voice.`);
        }
    };

    const handleAddMemory = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMemory.trim()) {
            addMemory(newMemory.trim());
            setNewMemory('');
        }
    };

    const handleEdit = (persona: Persona) => {
        setEditingPersona(persona);
        setIsFormOpen(true);
    };
    
    const handleCreate = () => {
        setEditingPersona(undefined);
        setIsFormOpen(true);
    };

    const handleSave = (persona: Persona) => {
        if (persona.id) {
            updatePersona(persona);
        } else {
            addPersona(persona);
        }
        setIsFormOpen(false);
    };

    const handleDelete = (personaId: string) => {
        if (window.confirm("Are you sure you want to delete this persona?")) {
            deletePersona(personaId);
        }
    };
    
    const handleNotificationToggle = () => {
        if (permission !== 'granted') {
            requestPermission();
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
             {isFormOpen && <PersonaForm persona={editingPersona} onSave={handleSave} onCancel={() => setIsFormOpen(false)} />}
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">Settings</h2>
                    <p className="text-sm text-text-secondary">Customize your Aura experience.</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-2xl mx-auto space-y-8">
                    <section>
                        <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center"><BellIcon className="w-6 h-6 mr-2"/>Notifications</h3>
                        <div className="bg-primary rounded-lg p-4">
                             <div className="flex items-center justify-between">
                                <label htmlFor="notification-toggle" className="flex flex-col pr-4">
                                    <span className="font-medium">Enable Event Reminders</span>
                                    <span className="text-sm text-text-secondary">
                                        Get notified 10 minutes before a calendar event starts.
                                        Current status: <span className="font-semibold">{permission}</span>
                                    </span>
                                </label>
                                <button
                                    id="notification-toggle"
                                    role="switch"
                                    aria-checked={permission === 'granted'}
                                    onClick={handleNotificationToggle}
                                    disabled={permission === 'granted' || permission === 'denied'}
                                    className={`${permission === 'granted' ? 'bg-accent' : 'bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    <span className={`${permission === 'granted' ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
                                </button>
                            </div>
                        </div>
                    </section>
                    
                     <section>
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="text-lg font-semibold text-text-primary flex items-center"><UserCircleIcon className="w-6 h-6 mr-2"/>Persona Manager</h3>
                             <button onClick={handleCreate} className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-blue-500">
                                <PlusIcon className="w-4 h-4" />
                                Create
                             </button>
                        </div>
                        <div className="bg-primary rounded-lg p-4 space-y-3">
                           {personas.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{p.avatar}</span>
                                    <span className="font-medium">{p.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleEdit(p)} className="p-1.5 text-text-secondary hover:text-accent"><EditIcon className="w-5 h-5"/></button>
                                    {p.custom && <button onClick={() => handleDelete(p.id)} className="p-1.5 text-text-secondary hover:text-red-500"><DeleteIcon className="w-5 h-5"/></button>}
                                </div>
                            </div>
                           ))}
                        </div>
                    </section>
                    
                    <section>
                        <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center"><MemoryIcon className="w-6 h-6 mr-2"/>Memory</h3>
                        <div className="bg-primary rounded-lg p-4">
                            <p className="text-sm text-text-secondary mb-4">
                                Add facts for Aura to remember about you to personalize your interactions, especially in Live Conversation mode.
                            </p>
                            <form onSubmit={handleAddMemory} className="flex gap-2 mb-4">
                                <input 
                                    type="text"
                                    value={newMemory}
                                    onChange={(e) => setNewMemory(e.target.value)}
                                    placeholder="e.g., My favorite color is blue"
                                    className="w-full bg-secondary border border-border rounded-lg p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                                <button type="submit" className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-500 disabled:opacity-50" disabled={!newMemory.trim()}>Add</button>
                            </form>
                            <div className="space-y-2">
                                {memory.length > 0 ? (
                                    memory.map(mem => (
                                        <div key={mem.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                                            <p className="text-sm">{mem.fact}</p>
                                            <button onClick={() => deleteMemory(mem.id)} className="p-1.5 text-text-secondary hover:text-red-500"><DeleteIcon className="w-5 h-5"/></button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-center text-text-secondary py-2">No memories saved yet.</p>
                                )}
                            </div>
                        </div>
                    </section>

                     <section>
                        <h3 className="text-lg font-semibold text-text-primary mb-4">Chat</h3>
                        <div className="bg-primary rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <label htmlFor="streaming-toggle" className="flex flex-col pr-4">
                                    <span className="font-medium">Stream Responses</span>
                                    <span className="text-sm text-text-secondary">Receive answers as they are generated, like a typewriter.</span>
                                </label>
                                <button
                                    id="streaming-toggle"
                                    role="switch"
                                    aria-checked={useStreaming}
                                    onClick={() => setUseStreaming(!useStreaming)}
                                    className={`${useStreaming ? 'bg-accent' : 'bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0`}
                                >
                                    <span className={`${useStreaming ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
                                </button>
                            </div>
                        </div>
                    </section>
                    
                    <section>
                        <h3 className="text-lg font-semibold text-text-primary mb-4">Speech Output (Text-to-Speech)</h3>
                        <div className="bg-primary rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <label htmlFor="autospeak-toggle" className="flex flex-col pr-4">
                                    <span className="font-medium">Auto-speak Responses</span>
                                    <span className="text-sm text-text-secondary">Automatically read out model responses after they are generated.</span>
                                </label>
                                <button
                                    id="autospeak-toggle"
                                    role="switch"
                                    aria-checked={autoSpeak}
                                    onClick={() => setAutoSpeak(!autoSpeak)}
                                    className={`${autoSpeak ? 'bg-accent' : 'bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0`}
                                >
                                    <span className={`${autoSpeak ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
                                </button>
                            </div>
                            <div>
                                <label htmlFor="voice-select" className="block text-sm font-medium mb-1">Voice</label>
                                <div className="flex items-center gap-2">
                                     <select
                                        id="voice-select"
                                        value={selectedVoice}
                                        onChange={(e) => setSelectedVoice(e.target.value)}
                                        className="w-full bg-secondary border border-border rounded-lg p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                    >
                                        {voices.map(voice => (
                                            <option key={voice.uri} value={voice.uri}>
                                                {voice.name} ({voice.lang})
                                            </option>
                                        ))}
                                    </select>
                                    <button onClick={handleTestVoice} disabled={isPlaying} className="px-4 py-2 bg-accent text-white rounded-lg disabled:opacity-50">
                                        {isPlaying ? 'Playing...' : 'Test'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                         <h3 className="text-lg font-semibold text-text-primary mb-4">Data Management</h3>
                         <div className="bg-primary rounded-lg p-4">
                             <div className="flex items-center justify-between">
                                <div className="flex flex-col pr-4">
                                    <span className="font-medium">Clear Chat History</span>
                                    <span className="text-sm text-text-secondary">Permanently delete all conversation history from your browser.</span>
                                </div>
                                <button onClick={clearAllChatHistory} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shrink-0">
                                    Delete All
                                </button>
                            </div>
                         </div>
                    </section>
                </div>
            </main>
        </div>
    );
};