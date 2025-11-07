import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useError } from '../contexts/ErrorContext';
import { generateContentWithTools } from '../services/geminiService';
import { fetchCalendarEvents, fetchUnreadGmailMessages } from '../services/googleApiService';
import { FunctionDeclaration, FunctionResponse, Part, Tool, Type, Content } from '@google/genai';
import { useGeolocation } from '../hooks/useGeolocation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DashboardSkeleton } from './DashboardSkeleton';
import { HomeIcon } from './icons/HomeIcon';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { useNotifications } from '../contexts/NotificationContext';
import { CalendarEvent } from '../types';
import { FeedbackButtons } from './FeedbackButtons';

const get_calendar_events_tool: FunctionDeclaration = {
    name: 'get_calendar_events',
    description: "Retrieves a list of the user's upcoming Google Calendar events for today.",
    parameters: { type: Type.OBJECT, properties: {} }
};

const get_recent_emails_tool: FunctionDeclaration = {
    name: 'get_recent_emails',
    description: "Retrieves the 5 most recent unread emails from the user's Gmail account.",
    parameters: { type: Type.OBJECT, properties: {} }
};

const get_current_weather_tool: FunctionDeclaration = {
    name: 'get_current_weather',
    description: "Gets the current weather for a given location.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            latitude: { type: Type.NUMBER, description: 'The latitude for the location.' },
            longitude: { type: Type.NUMBER, description: 'The longitude for the location.' }
        },
        required: ['latitude', 'longitude']
    }
};

const tools: Tool[] = [{
    functionDeclarations: [get_calendar_events_tool, get_recent_emails_tool, get_current_weather_tool]
}];


export const DashboardView: React.FC = () => {
    const { user, accessToken, signIn } = useAuth();
    const { setError } = useError();
    const { coordinates } = useGeolocation();
    const { scheduleNotification, permission } = useNotifications();
    const [isLoading, setIsLoading] = useState(false);
    const [briefing, setBriefing] = useState<string | null>(null);
    const { toggleMobileNav } = useMobileNav();

    const generateBriefing = useCallback(async () => {
        if (!accessToken || !coordinates || briefing) return;

        setIsLoading(true);

        try {
            const prompt = `Good morning! Please generate a concise and friendly daily briefing for me. I need to know about today's calendar events, my most important unread emails, and the current weather. Today's date is ${new Date().toLocaleDateString()}.`;
            
            // FIX: Pass a valid Content[] array to the updated generateContentWithTools function.
            const conversationHistory: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
            const modelResponse = await generateContentWithTools(conversationHistory, tools);
            const functionCalls = modelResponse.functionCalls;
            
            if (!functionCalls || functionCalls.length === 0) {
                setBriefing(modelResponse.text || "I couldn't generate a briefing right now. Please try again later.");
                setIsLoading(false);
                return;
            }
            
            conversationHistory.push(modelResponse.candidates![0].content);

            const functionExecutionPromises = functionCalls.map(async (call) => {
                let result: any;
                let name = call.name;
                switch (name) {
                    case 'get_calendar_events':
                        const events: CalendarEvent[] = await fetchCalendarEvents(accessToken, new Date().toISOString(), 5);
                        if (permission === 'granted') {
                            events.forEach(event => {
                                const eventTime = new Date(event.start.dateTime || event.start.date!).getTime();
                                const now = Date.now();
                                const tenMinutes = 10 * 60 * 1000;
                                // Schedule notification 10 minutes before
                                const notificationTime = eventTime - tenMinutes;
                                if (notificationTime > now) {
                                     scheduleNotification(
                                        'Aura Reminder',
                                        `Your event "${event.summary}" starts in 10 minutes.`,
                                        notificationTime
                                    );
                                }
                            });
                        }
                        result = events;
                        break;
                    case 'get_recent_emails':
                        result = await fetchUnreadGmailMessages(accessToken, 3);
                        break;
                    case 'get_current_weather':
                        // This is mock data as there's no weather API integration.
                        result = { temperature: "22°C", condition: "Sunny with scattered clouds" };
                        break;
                    default:
                        result = { error: 'Unknown function' };
                }
                return { functionResponse: { name, response: { result } } };
            });
            
            const toolResponseParts = await Promise.all(functionExecutionPromises);
            
            // FIX: Construct a valid user turn with function responses and continue the conversation history.
            conversationHistory.push({ role: 'user', parts: toolResponseParts as Part[] });

            const finalResponse = await generateContentWithTools(conversationHistory, tools);
            setBriefing(finalResponse.text);

        } catch (error: any) {
            setError(error.message || "An error occurred while generating your briefing.");
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, coordinates, briefing, setError, permission, scheduleNotification]);

    useEffect(() => {
        if (user && accessToken) {
            generateBriefing();
        }
    }, [user, accessToken, generateBriefing]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">Dashboard</h2>
                    <p className="text-sm text-text-secondary">Your daily briefing powered by AI.</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                    {user ? (
                        <>
                            <h1 className="text-2xl md:text-3xl font-bold mb-1">{getGreeting()}, {user.name.split(' ')[0]}.</h1>
                            <p className="text-md text-text-secondary mb-6">Here’s what you need to know to start your day.</p>
                            
                            {isLoading && <DashboardSkeleton />}

                            {!isLoading && briefing && (
                                <div className="bg-primary p-6 rounded-lg border border-border animate-fade-in relative group">
                                    <div className="markdown-content">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing}</ReactMarkdown>
                                    </div>
                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <FeedbackButtons />
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center h-full mt-16 p-4">
                             <HomeIcon className="w-16 h-16 text-text-secondary mb-4" />
                            <h2 className="text-2xl font-bold">Welcome to Aura</h2>
                            <p className="max-w-md mt-2 text-text-secondary">
                                Sign in with your Google account to get a personalized daily briefing,
                                manage your calendar, summarize emails, and more.
                            </p>
                            <button onClick={signIn} className="mt-6 px-6 py-3 bg-accent text-white rounded-lg hover:bg-blue-500 transition-colors">
                                Sign In to Get Started
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};