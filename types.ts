import { Content } from "@google/genai";
import React from "react";

export enum AppView {
    DASHBOARD = 'dashboard',
    CHAT = 'chat',
    TOOLKIT = 'toolkit',
    SEARCH = 'search',
    MAPS = 'maps',
    GMAIL = 'gmail',
    CALENDAR = 'calendar',
    DRIVE = 'drive',
    LIVE = 'live',
    VIDEO_ANALYSIS = 'video-analysis',
    VIDEO_GENERATION = 'video-generation',
    TRIP_PLANNER = 'trip-planner',
    AGENTS = 'agents',
    SETTINGS = 'settings',
}

export enum ToolCategory {
    MAIN = 'Main Tools',
    INTEGRATIONS = 'Google Integrations',
    MEDIA = 'Media Tools',
    EXPERIMENTAL = 'Experimental',
}

export interface ToolDefinition {
    id: AppView;
    name: string;
    component: React.LazyExoticComponent<React.FC<{}>>;
    icon: React.FC<{ className?: string }>;
    category: ToolCategory;
    authRequired: boolean;
}

export interface Persona {
    id: string;
    name: string;
    avatar: string;
    prompt: string;
    custom?: boolean;
}

export interface ChatMessage {
    id:string;
    role: 'user' | 'model';
    text?: string;
    image?: {
        data: string;
        mimeType: string;
    };
    persona?: Persona;
}

export interface GoogleUser {
    name: string;
    email: string;
    picture: string;
}

export interface VoiceOption {
    name: string;
    lang: string;
    uri: string;
}

export interface GeolocationState {
    loading: boolean;
    coordinates: GeolocationCoordinates | null;
    error: GeolocationPositionError | null;
}

export interface WebDetails {
    uri: string;
    title: string;
}

export interface ReviewSnippet {
    author: string;
    starRating: number;
    textContent: string;
    uri: string;
}

export interface PlaceAnswerSource {
    reviewSnippets: ReviewSnippet[];
}

export interface MapDetails {
    uri: string;
    title: string;
    placeAnswerSources?: PlaceAnswerSource[];
}

export interface GroundingChunk {
    web?: WebDetails;
    maps?: MapDetails;
}

export interface CalendarEvent {
    id: string;
    summary: string;
    htmlLink: string;
    start: {
        dateTime?: string;
        date?: string;
    };
    end: {
        dateTime?: string;
        date?: string;
    };
}

export interface Memory {
    id: string;
    fact: string;
}

export interface Agent {
    id: string;
    name: string;
    goal: string;
    logs: AgentRunLog[];
}

export interface AgentRunLog {
    id: string;
    timestamp: number;
    status: 'success' | 'failure';
    result: string;
    steps: string[];
}
