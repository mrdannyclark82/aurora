import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useError } from '../contexts/ErrorContext';
import { PlaneIcon } from './icons/PlaneIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { generateContentWithTools } from '../services/geminiService';
import { FunctionDeclaration, Tool, Type, Part, Content, GenerateContentResponse, GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { FeedbackButtons } from './FeedbackButtons';

// Mock function declarations - in a real app, these would call flight/hotel APIs.
const find_flights_tool: FunctionDeclaration = {
  name: 'find_flights',
  description: 'Finds flights for a given origin, destination, and dates.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      origin: { type: Type.STRING, description: 'The departure city or airport code.' },
      destination: { type: Type.STRING, description: 'The arrival city or airport code.' },
      departure_date: { type: Type.STRING, description: 'The departure date in YYYY-MM-DD format.' },
      return_date: { type: Type.STRING, description: 'The return date in YYYY-MM-DD format (optional).' },
    },
    required: ['origin', 'destination', 'departure_date'],
  },
};

const find_hotels_tool: FunctionDeclaration = {
  name: 'find_hotels',
  description: 'Finds hotels in a given location for specific dates.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: { type: Type.STRING, description: 'The city or area to search for hotels.' },
      check_in_date: { type: Type.STRING, description: 'The check-in date in YYYY-MM-DD format.' },
      check_out_date: { type: Type.STRING, description: 'The check-out date in YYYY-MM-DD format.' },
    },
    required: ['location', 'check_in_date', 'check_out_date'],
  },
};

const tools: Tool[] = [{ functionDeclarations: [find_flights_tool, find_hotels_tool] }];

export const TripPlannerView: React.FC = () => {
    const { accessToken } = useAuth();
    const { setError } = useError();
    const [isLoading, setIsLoading] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [result, setResult] = useState<string | null>(null);
    const [status, setStatus] = useState('');
    const { toggleMobileNav } = useMobileNav();
    const conversationHistoryRef = useRef<Content[]>([]);

    // Mock API call functions
    const findFlightsAPI = async (args: any) => {
        console.log("Searching for flights with args:", args);
        // In a real app, this would call a flight search API.
        return {
            flights: [
                { airline: "Gemini Air", price: "$350", duration: "4h 30m", departure: `${args.departure_date} 08:00` },
                { airline: "Aura Flights", price: "$400", duration: "4h 15m", departure: `${args.departure_date} 09:30` },
            ]
        };
    };
    
    const findHotelsAPI = async (args: any) => {
        console.log("Searching for hotels with args:", args);
        // In a real app, this would call a hotel search API.
        return {
            hotels: [
                { name: "The Gemini Grand", rating: "4.5 stars", price_per_night: "$250" },
                { name: "Aura Suites", rating: "4.2 stars", price_per_night: "$180" },
            ]
        };
    };


    const handlePlanTrip = async () => {
        if (!accessToken || !prompt.trim()) return;

        setIsLoading(true);
        setResult(null);
        setStatus('Thinking about your trip...');
        conversationHistoryRef.current = [];

        try {
            const userContent: Content = { role: 'user', parts: [{ text: prompt }] };
            conversationHistoryRef.current.push(userContent);
            
            let modelResponse: GenerateContentResponse = await generateContentWithTools(conversationHistoryRef.current, tools);
            
            while (modelResponse.functionCalls && modelResponse.functionCalls.length > 0) {
                conversationHistoryRef.current.push(modelResponse.candidates![0].content);
                const functionCalls = modelResponse.functionCalls;
                const functionResponseParts: Part[] = [];

                for (const call of functionCalls) {
                     let callResult: any;
                    if (call.name === 'find_flights') {
                        setStatus(`Finding flights from ${call.args.origin} to ${call.args.destination}...`);
                        callResult = await findFlightsAPI(call.args);
                    } else if (call.name === 'find_hotels') {
                        setStatus(`Finding hotels in ${call.args.location}...`);
                        callResult = await findHotelsAPI(call.args);
                    }
                    functionResponseParts.push({ functionResponse: { name: call.name, response: { result: callResult } }});
                }
                
                conversationHistoryRef.current.push({ role: 'user', parts: functionResponseParts });
                setStatus('Putting together your itinerary...');
                modelResponse = await generateContentWithTools(conversationHistoryRef.current, tools);
            }

            setResult(modelResponse.text);

        } catch (error: any) {
            setError(error.message || 'An error occurred while planning your trip.');
        } finally {
            setIsLoading(false);
            setStatus('');
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">Trip Planner</h2>
                    <p className="text-sm text-text-secondary">Let Aura help you plan your next getaway.</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col gap-4 mb-6">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., Plan a weekend trip to Paris from London next month. Find flights and a hotel."
                            className="w-full flex-grow bg-primary border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                            rows={3}
                            disabled={isLoading}
                        />
                        <button
                            onClick={handlePlanTrip}
                            disabled={isLoading || !prompt.trim()}
                            className="w-full p-3 rounded-lg bg-accent text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
                        >
                            {isLoading ? <SpinnerIcon className="w-5 h-5 mx-auto animate-spin" /> : 'Plan My Trip'}
                        </button>
                    </div>

                    {isLoading && (
                        <div className="text-center text-text-secondary">
                             <SpinnerIcon className="w-8 h-8 mx-auto animate-spin text-accent" />
                             <p className="mt-2 text-sm">{status || 'Processing...'}</p>
                        </div>
                    )}
                    
                    {result && !isLoading && (
                        <div className="bg-primary p-6 rounded-lg animate-fade-in border border-border relative group">
                            <h3 className="text-lg font-semibold mb-4">Your Trip Itinerary:</h3>
                            <div className="markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                            </div>
                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <FeedbackButtons />
                            </div>
                        </div>
                    )}

                    {!result && !isLoading && (
                         <div className="text-center mt-16 text-text-secondary p-4">
                            <PlaneIcon className="w-16 h-16 mx-auto" />
                            <h3 className="mt-4 text-xl font-semibold">Where to next?</h3>
                            <p className="mt-2 max-w-md mx-auto">
                                Describe your ideal trip, and Aura will search for flights, hotels, and activities to build an itinerary for you.
                            </p>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};