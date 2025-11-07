import { GoogleGenAI, GenerateContentResponse, Tool, Chat, Modality, Part, Content } from "@google/genai";
import { ChatMessage, Persona, Memory } from "../types";

// This file is now a PROXY CLIENT. It does not directly use the GenAI SDK.
// It sends requests to our own backend proxy endpoint.

const proxyFetch = async (action: string, params: object) => {
    const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            service: 'gemini',
            action,
            ...params
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `An error occurred with the Gemini API proxy for action: ${action}.`);
    }
    
    // For streaming responses, we return the raw response to be handled by the caller
    if (action.includes('Stream')) {
        return response;
    }

    return response.json();
};


export const generateText = (prompt: string, modelName: string = 'gemini-2.5-flash'): Promise<{ text: string }> => {
    return proxyFetch('generateText', { prompt, modelName });
};

export const getYoutubeTranscript = (videoId: string): Promise<{ transcript: string }> => {
    return proxyFetch('getYoutubeTranscript', { videoId });
};

export const generateSearchResponse = (query: string): Promise<GenerateContentResponse> => {
    return proxyFetch('generateSearch', { query });
};

export const generateMapsResponse = (query: string, latitude: number, longitude: number): Promise<GenerateContentResponse> => {
    return proxyFetch('generateMaps', { query, latitude, longitude });
};

export const analyzeVideo = (prompt: string, videoBase64: string, mimeType: string): Promise<{ text: string }> => {
    return proxyFetch('analyzeVideo', { prompt, videoBase64, mimeType });
};

export const generateImage = (prompt: string, aspectRatio: string): Promise<{ imageUrl: string }> => {
    return proxyFetch('generateImage', { prompt, aspectRatio });
};

export const generateSpeech = (text: string, voiceName: string): Promise<{ base64Audio: string }> => {
    return proxyFetch('generateSpeech', { text, voiceName });
};

export const generateVideo = (prompt: string, aspectRatio: '16:9' | '9:16', resolution: '720p' | '1080p'): Promise<any> => {
    return proxyFetch('generateVideo', { prompt, aspectRatio, resolution });
};

export const getVideosOperation = (operation: any): Promise<any> => {
    return proxyFetch('getVideosOperation', { operation });
};

export const fetchVideoBlob = async (downloadLink: string): Promise<Blob> => {
    const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'gemini', action: 'fetchVideo', downloadLink }),
    });
     if (!response.ok) throw new Error('Failed to fetch video via proxy');
    return response.blob();
};

export const generateChatResponseStream = (
    chatHistory: ChatMessage[], 
    newMessage: { parts: Part[] },
    persona: Persona,
    memory?: Memory[],
    tools?: Tool[]
): Promise<Response> => {
     return proxyFetch('generateChatStream', { chatHistory, newMessage, persona, memory, tools });
};

// Fix: Add a non-streaming chat response function for use in ChatView.
export const generateChatResponse = (
    chatHistory: ChatMessage[],
    newMessage: { parts: Part[] },
    persona: Persona,
    memory?: Memory[],
    tools?: Tool[]
): Promise<GenerateContentResponse> => {
    return proxyFetch('generateChat', { chatHistory, newMessage, persona, memory, tools });
};

export const generateContentWithTools = (contents: Content[], tools: Tool[]): Promise<GenerateContentResponse> => {
    return proxyFetch('generateWithTools', { contents, tools });
};

export const runAgent = (goal: string, accessToken: string): Promise<any> => {
    // We pass the access token here because the agent needs it to execute tools like reading email
     return fetch('/api/proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            service: 'gemini',
            action: 'runAgent',
            goal
        }),
    }).then(res => res.json());
};

export const proposeUpdate = (prompt: string, sourceFiles: Record<string, string>): Promise<any> => {
    return proxyFetch('proposeUpdate', { prompt, sourceFiles });
};