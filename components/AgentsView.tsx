import React, { useState } from 'react';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { CpuChipIcon } from './icons/CpuChipIcon';
import { useSettings } from '../contexts/SettingsContext';
import { Agent, AgentRunLog } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import { useError } from '../contexts/ErrorContext';
import { useAuth } from '../contexts/AuthContext';
import { runAgent } from '../services/geminiService';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { useNotifications } from '../contexts/NotificationContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// Fix: Import the missing EditIcon component.
import { EditIcon } from './icons/EditIcon';
import { FunctionDeclaration, Tool, Type } from '@google/genai';

const AgentForm: React.FC<{ agent?: Agent, onSave: (agent: Agent) => void, onCancel: () => void }> = ({ agent, onSave, onCancel }) => {
    const [name, setName] = useState(agent?.name || '');
    const [goal, setGoal] = useState(agent?.goal || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !goal.trim()) {
            alert("Name and Goal are required.");
            return;
        }
        onSave({
            ...agent,
            id: agent?.id || '',
            name,
            goal,
            logs: agent?.logs || [],
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={onCancel}>
            <div className="bg-secondary p-6 rounded-lg shadow-xl w-full max-w-lg m-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{agent ? 'Edit' : 'Create'} Agent</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-1">Agent Name</label>
                        <input id="name" type="text" value={name} onChange={e => setName(e.target.value)}
                            className="w-full bg-primary border border-border rounded-lg p-2 text-text-primary" required />
                    </div>
                    <div>
                        <label htmlFor="goal" className="block text-sm font-medium mb-1">Goal (Natural Language)</label>
                        <textarea id="goal" value={goal} onChange={e => setGoal(e.target.value)}
                            className="w-full h-32 bg-primary border border-border rounded-lg p-2 text-text-primary resize-none"
                            placeholder="e.g., Check my unread emails. If an email from my manager (manager@example.com) is urgent, summarize it and notify me." required />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onCancel} className="px-4 py-2 bg-primary hover:bg-border rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-500">Save Agent</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const search_youtube_tool: FunctionDeclaration = {
  name: 'search_youtube',
  description: "Searches YouTube for videos matching a query.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'The search term to find videos.' },
    },
    required: ['query'],
  },
};

const tools: Tool[] = [{ functionDeclarations: [search_youtube_tool] }];

export const AgentsView: React.FC = () => {
    const { toggleMobileNav } = useMobileNav();
    const { agents, addAgent, updateAgent, deleteAgent } = useSettings();
    const { setError } = useError();
    const { accessToken } = useAuth();
    const { scheduleNotification, permission } = useNotifications();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Agent | undefined>(undefined);
    const [runningAgentId, setRunningAgentId] = useState<string | null>(null);

    const handleSave = (agent: Agent) => {
        if (agent.id) {
            updateAgent(agent);
        } else {
            addAgent(agent);
        }
        setIsFormOpen(false);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Are you sure you want to delete this agent?")) {
            deleteAgent(id);
        }
    };
    
    // Mock YouTube API call function
    const searchYoutubeAPI = async (args: any) => {
        console.log("Searching YouTube for:", args.query);
        // In a real app, this would call the YouTube Data API.
        return {
            videos: [
                { title: "The 5 NEW AI Tools That Are A BIG DEAL!", channel: "Matt Wolfe", videoId: "dQw4w9WgXcQ" },
                { title: "Mind-Blowing AI Tools You've Never Seen!", channel: "Futurepedia", videoId: "y6120QOlsfU" },
                { title: "These AI Tools will 10x Your Productivity", channel: "MKBHD", videoId: "a6_8-S0mD3E" },
            ]
        };
    };

    const handleRunAgent = async (agent: Agent) => {
        if (!accessToken) {
            setError("You must be signed in to run agents.");
            return;
        }
        setRunningAgentId(agent.id);
        try {
            const result = await runAgent(agent.goal, accessToken);
            
            const newLog: AgentRunLog = {
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                status: 'success',
                result: result.finalAnswer,
                steps: result.steps,
            };

            const updatedAgent = { ...agent, logs: [newLog, ...agent.logs.slice(0, 4)] };
            updateAgent(updatedAgent);

            if (result.shouldNotify && permission === 'granted') {
                scheduleNotification(
                    `Aura Agent: ${agent.name}`,
                    result.finalAnswer,
                    Date.now() + 1000 // schedule 1 second in the future
                );
            }

        } catch (error: any) {
            setError(error.message || `Agent "${agent.name}" failed to run.`);
             const newLog: AgentRunLog = {
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                status: 'failure',
                result: error.message || 'An unknown error occurred.',
                steps: [],
            };
            const updatedAgent = { ...agent, logs: [newLog, ...agent.logs.slice(0, 4)] };
            updateAgent(updatedAgent);
        } finally {
            setRunningAgentId(null);
        }
    };


    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            {isFormOpen && <AgentForm agent={editingAgent} onSave={handleSave} onCancel={() => setIsFormOpen(false)} />}
            <header className="p-4 border-b border-border flex justify-between items-center">
                <div className="flex items-center">
                    <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                        <MenuIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold">Background Agents</h2>
                        <p className="text-sm text-text-secondary">Autonomous agents to complete complex tasks.</p>
                    </div>
                </div>
                 <button onClick={() => { setEditingAgent(undefined); setIsFormOpen(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-blue-500">
                    <PlusIcon className="w-4 h-4" />
                    New Agent
                 </button>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                {agents.length > 0 ? (
                    <div className="space-y-6">
                        {agents.map(agent => (
                            <div key={agent.id} className="bg-primary p-4 rounded-lg border border-border">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-lg">{agent.name}</h3>
                                        <p className="text-sm text-text-secondary mt-1 max-w-xl italic">Goal: "{agent.goal}"</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-4">
                                         <button onClick={() => handleRunAgent(agent)} disabled={runningAgentId === agent.id} className="px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2">
                                            {runningAgentId === agent.id ? <SpinnerIcon className="w-4 h-4 animate-spin"/> : null}
                                            {runningAgentId === agent.id ? 'Running...' : 'Run Now'}
                                         </button>
                                         <button onClick={() => { setEditingAgent(agent); setIsFormOpen(true); }} className="p-2 text-text-secondary hover:text-accent"><EditIcon className="w-5 h-5"/></button>
                                         <button onClick={() => handleDelete(agent.id)} className="p-2 text-text-secondary hover:text-red-500"><DeleteIcon className="w-5 h-5"/></button>
                                    </div>
                                </div>
                                <div className="mt-4 border-t border-border pt-3">
                                    <h4 className="text-sm font-medium text-text-secondary mb-2">Recent Activity:</h4>
                                    {agent.logs.length > 0 ? (
                                        <div className="space-y-3 max-h-64 overflow-y-auto">
                                            {agent.logs.map(log => (
                                                <div key={log.id} className={`p-3 rounded-md text-sm border ${log.status === 'success' ? 'bg-secondary border-border' : 'bg-red-900 bg-opacity-30 border-red-700'}`}>
                                                    <p className="font-semibold flex justify-between">
                                                        <span>Run {log.status === 'success' ? 'Succeeded' : 'Failed'}</span>
                                                        <span className="font-normal text-xs">{new Date(log.timestamp).toLocaleString()}</span>
                                                    </p>
                                                    {log.steps.length > 0 && (
                                                        <ul className="text-xs text-text-secondary list-disc list-inside mt-2 pl-2 space-y-1">
                                                            {log.steps.map((step, i) => <li key={i}>{step}</li>)}
                                                        </ul>
                                                    )}
                                                    <div className="mt-2 pt-2 border-t border-border border-opacity-50 markdown-content">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{log.result}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-text-secondary italic">No runs recorded yet. Click "Run Now" to start.</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center mt-16 text-text-secondary p-4">
                        <CpuChipIcon className="w-16 h-16 mx-auto" />
                        <h3 className="mt-4 text-xl font-semibold">No Agents Created Yet</h3>
                        <p className="mt-2 max-w-md mx-auto">
                            Create your first autonomous agent to monitor information and perform tasks for you in the background.
                        </p>
                        <button onClick={() => setIsFormOpen(true)} className="mt-6 px-5 py-2 bg-accent text-white rounded-lg hover:bg-blue-500">
                           Create Your First Agent
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};