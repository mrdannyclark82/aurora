import { lazy } from 'react';
import { ToolDefinition, AppView, ToolCategory } from './types';

// Icons
import { HomeIcon } from './components/icons/HomeIcon';
import { ChatIcon } from './components/icons/ChatIcon';
import { SearchIcon } from './components/icons/SearchIcon';
import { MapIcon } from './components/icons/MapIcon';
import { MicIcon } from './components/icons/MicIcon';
import { GmailIcon } from './components/icons/GmailIcon';
import { CalendarIcon } from './components/icons/CalendarIcon';
import { DriveIcon } from './components/icons/DriveIcon';
import { PlaneIcon } from './components/icons/PlaneIcon';
import { VideoIcon } from './components/icons/VideoIcon';
import { FilmIcon } from './components/icons/FilmIcon';
import { ToolboxIcon } from './components/icons/ToolboxIcon';
import { CpuChipIcon } from './components/icons/CpuChipIcon';

export const tools: ToolDefinition[] = [
    {
        id: AppView.DASHBOARD,
        name: 'Dashboard',
        component: lazy(() => import('./components/DashboardView').then(module => ({ default: module.DashboardView }))),
        icon: HomeIcon,
        category: ToolCategory.MAIN,
        authRequired: true,
    },
    {
        id: AppView.CHAT,
        name: 'General Chat',
        component: lazy(() => import('./components/ChatView').then(module => ({ default: module.ChatView }))),
        icon: ChatIcon,
        category: ToolCategory.MAIN,
        authRequired: false,
    },
    {
        id: AppView.TOOLKIT,
        name: 'Toolkit',
        component: lazy(() => import('./components/ToolkitView').then(module => ({ default: module.ToolkitView }))),
        icon: ToolboxIcon,
        category: ToolCategory.MAIN,
        authRequired: false,
    },
    {
        id: AppView.SEARCH,
        name: 'Web Search',
        component: lazy(() => import('./components/SearchView').then(module => ({ default: module.SearchView }))),
        icon: SearchIcon,
        category: ToolCategory.INTEGRATIONS,
        authRequired: false,
    },
    {
        id: AppView.MAPS,
        name: 'Local Guide',
        component: lazy(() => import('./components/MapsView').then(module => ({ default: module.MapsView }))),
        icon: MapIcon,
        category: ToolCategory.INTEGRATIONS,
        authRequired: false,
    },
    {
        id: AppView.GMAIL,
        name: 'Gmail',
        component: lazy(() => import('./components/GmailView').then(module => ({ default: module.GmailView }))),
        icon: GmailIcon,
        category: ToolCategory.INTEGRATIONS,
        authRequired: true,
    },
    {
        id: AppView.CALENDAR,
        name: 'Calendar',
        component: lazy(() => import('./components/CalendarView').then(module => ({ default: module.CalendarView }))),
        icon: CalendarIcon,
        category: ToolCategory.INTEGRATIONS,
        authRequired: true,
    },
    {
        id: AppView.DRIVE,
        name: 'Drive',
        component: lazy(() => import('./components/DriveView').then(module => ({ default: module.DriveView }))),
        icon: DriveIcon,
        category: ToolCategory.INTEGRATIONS,
        authRequired: true,
    },
    {
        id: AppView.LIVE,
        name: 'Live Conversation',
        component: lazy(() => import('./components/LiveView').then(module => ({ default: module.LiveView }))),
        icon: MicIcon,
        category: ToolCategory.MEDIA,
        authRequired: false,
    },
    {
        id: AppView.VIDEO_ANALYSIS,
        name: 'Video Analysis',
        component: lazy(() => import('./components/VideoAnalysisView').then(module => ({ default: module.VideoAnalysisView }))),
        icon: VideoIcon,
        category: ToolCategory.MEDIA,
        authRequired: false,
    },
    {
        id: AppView.VIDEO_GENERATION,
        name: 'Video Generation',
        component: lazy(() => import('./components/VideoGenerationView').then(module => ({ default: module.VideoGenerationView }))),
        icon: FilmIcon,
        category: ToolCategory.MEDIA,
        authRequired: false,
    },
    {
        id: AppView.TRIP_PLANNER,
        name: 'Trip Planner',
        component: lazy(() => import('./components/TripPlannerView').then(module => ({ default: module.TripPlannerView }))),
        icon: PlaneIcon,
        category: ToolCategory.EXPERIMENTAL,
        authRequired: true,
    },
    {
        id: AppView.AGENTS,
        name: 'Background Agents',
        component: lazy(() => import('./components/AgentsView').then(module => ({ default: module.AgentsView }))),
        icon: CpuChipIcon,
        category: ToolCategory.EXPERIMENTAL,
        authRequired: true,
    }
];
