import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useError } from '../contexts/ErrorContext';
import { CalendarIcon } from './icons/CalendarIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { fetchCalendarEvents, createCalendarEvent } from '../services/googleApiService';
import { generateContentWithTools } from '../services/geminiService';
import { FunctionDeclaration, Tool, Type, Content, GenerateContentResponse } from '@google/genai';
import { CalendarEvent } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { FeedbackButtons } from './FeedbackButtons';

const create_calendar_event_tool: FunctionDeclaration = {
  name: 'create_calendar_event',
  description: 'Creates a new event on the user\'s Google Calendar.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'The title or summary of the event.' },
      description: { type: Type.STRING, description: 'A detailed description of the event.' },
      location: { type: Type.STRING, description: 'The location of the event.' },
      start_time: { type: Type.STRING, description: 'The start time of the event in ISO 8601 format.' },
      end_time: { type: Type.STRING, description: 'The end time of the event in ISO 8601 format.' },
      attendees: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'A list of attendee email addresses.' },
    },
    required: ['title', 'start_time', 'end_time']
  },
};

const tools: Tool[] = [{ functionDeclarations: [create_calendar_event_tool] }];

const CalendarSkeleton: React.FC = () => (
    <div className="animate-pulse">
        <ul className="divide-y divide-border">
            {[...Array(5)].map((_, i) => (
                <li key={i} className="p-4">
                    <div className="h-5 w-3/4 bg-secondary rounded-md mb-2"></div>
                    <div className="h-4 w-1/2 bg-secondary rounded-md"></div>
                </li>
            ))}
        </ul>
    </div>
);


export const CalendarView: React.FC = () => {
    const { accessToken } = useAuth();
    const { setError } = useError();
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [prompt, setPrompt] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const { toggleMobileNav } = useMobileNav();

    const loadEvents = useCallback(async () => {
        if (!accessToken) return;
        setIsLoading(true);
        try {
            const fetchedEvents = await fetchCalendarEvents(accessToken);
            setEvents(fetchedEvents);
        } catch (error: any) {
            setError(error.message || 'Failed to load calendar events.');
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, setError]);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const handleCreateEvent = async () => {
        if (!accessToken || !prompt.trim()) return;
        
        setIsCreating(true);
        setConfirmation('');

        try {
            // FIX: Pass a valid Content[] array to the updated generateContentWithTools function.
            const modelResponse: GenerateContentResponse = await generateContentWithTools([{ role: 'user', parts: [{ text: prompt }] }], tools);
            const functionCall = modelResponse.functionCalls?.[0];

            if (functionCall?.name === 'create_calendar_event') {
                const args = functionCall.args;
                const newEvent = {
                    summary: args.title,
                    description: args.description,
                    location: args.location,
                    start: { dateTime: args.start_time },
                    end: { dateTime: args.end_time },
                    attendees: args.attendees?.map((email: string) => ({ email })),
                };
                await createCalendarEvent(accessToken, newEvent);
                setConfirmation(`Event "${args.title}" created successfully!`);
                setPrompt('');
                loadEvents();
            } else {
                setConfirmation(modelResponse.text || "I couldn't figure out how to schedule that. Try being more specific, like 'Schedule a meeting tomorrow at 2pm'.");
            }
        } catch (error: any) {
            setError(error.message || 'Failed to create event.');
        } finally {
            setIsCreating(false);
        }
    };
    
    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">Calendar Assistant</h2>
                    <p className="text-sm text-text-secondary">View upcoming events and schedule new ones.</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-semibold" id="create-event-heading">Create a new event</h3>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., Schedule a project sync with fake@email.com tomorrow from 2pm to 3pm"
                        className="w-full flex-grow bg-primary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                        rows={4}
                        disabled={isCreating}
                        aria-labelledby="create-event-heading"
                    />
                    <button
                        onClick={handleCreateEvent}
                        disabled={isCreating || !prompt.trim()}
                        className="w-full p-3 rounded-lg bg-accent text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
                    >
                        {isCreating ? <SpinnerIcon className="w-5 h-5 mx-auto animate-spin" /> : 'Schedule Event'}
                    </button>
                    {confirmation && (
                        <div className="p-3 bg-primary rounded-lg text-sm text-text-primary animate-fade-in group relative">
                            <div className="markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{confirmation}</ReactMarkdown>
                            </div>
                            <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <FeedbackButtons />
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-primary rounded-lg h-full overflow-y-auto flex flex-col">
                    <h3 className="text-lg font-semibold p-4 sticky top-0 bg-primary border-b border-border">Upcoming Events</h3>
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                           <CalendarSkeleton />
                        ) : events.length > 0 ? (
                            <ul className="divide-y divide-border">
                                {events.map(event => (
                                    <li key={event.id} className="p-4 hover:bg-secondary">
                                        <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
                                            <p className="font-semibold text-text-primary">{event.summary}</p>
                                            <p className="text-sm text-text-secondary">
                                                {new Date(event.start.dateTime || event.start.date!).toLocaleString()}
                                            </p>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center p-10 text-text-secondary">
                                <CalendarIcon className="w-12 h-12 mx-auto mb-2" />
                                <p>No upcoming events found.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};