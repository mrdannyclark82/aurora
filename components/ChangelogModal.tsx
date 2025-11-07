import React from 'react';
import { useChangelog } from '../contexts/ChangelogContext';
import { APP_VERSION } from '../version';
import { CloseIcon } from './icons/CloseIcon';

export const ChangelogModal: React.FC = () => {
    const { isChangelogVisible, hideChangelog } = useChangelog();

    if (!isChangelogVisible) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 animate-fade-in">
            <div className="bg-secondary p-6 rounded-lg shadow-xl w-full max-w-lg m-4 border border-border">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-text-primary">What's New in Aura</h2>
                    <button onClick={hideChangelog} className="p-1 rounded-full hover:bg-primary">
                        <CloseIcon className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>
                <div className="text-sm text-text-secondary mb-4">
                    You are now on version <span className="font-semibold text-accent">{APP_VERSION}</span>. Here are the latest updates:
                </div>
                <div className="max-h-80 overflow-y-auto pr-2 space-y-4">
                     <div className="p-3 bg-primary rounded-md">
                        <h3 className="font-semibold text-text-primary mb-1">🤖 New AI Agent: Trip Planner</h3>
                        <p className="text-sm text-text-secondary">
                            Plan your next vacation! Give Aura a high-level goal (e.g., "Plan a 3-day trip to London"), and it will autonomously use its tools to find attractions and build an itinerary for you.
                        </p>
                    </div>
                     <div className="p-3 bg-primary rounded-md">
                        <h3 className="font-semibold text-text-primary mb-1">👍 User Feedback System</h3>
                        <p className="text-sm text-text-secondary">
                            You can now rate AI responses with a thumbs up or down. Hover over any generated message to see the new feedback options. This will help us improve Aura's quality over time.
                        </p>
                    </div>
                     <div className="p-3 bg-primary rounded-md">
                        <h3 className="font-semibold text-text-primary mb-1">✨ Product Maturity & Polish</h3>
                        <p className="text-sm text-text-secondary">
                           This update includes numerous small improvements to UI, performance, and accessibility to make your experience with Aura smoother and more enjoyable.
                        </p>
                    </div>
                </div>
                <div className="mt-6 text-right">
                    <button onClick={hideChangelog} className="px-5 py-2 bg-accent text-white rounded-lg hover:bg-blue-500">
                        Got It!
                    </button>
                </div>
            </div>
        </div>
    );
};
