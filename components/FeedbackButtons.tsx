import React, { useState } from 'react';
import { ThumbUpIcon } from './icons/ThumbUpIcon';
import { ThumbDownIcon } from './icons/ThumbDownIcon';

export const FeedbackButtons: React.FC = () => {
    const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null);

    const handleFeedback = (type: 'good' | 'bad') => {
        // In a real app, this would send an event to an analytics service.
        // For now, we just update the UI state.
        setFeedback(type);
    };

    return (
        <div className="flex items-center gap-1 bg-secondary border border-border rounded-full p-0.5">
            <button
                onClick={() => handleFeedback('good')}
                disabled={!!feedback}
                className={`p-1.5 rounded-full transition-colors ${
                    feedback === 'good' ? 'bg-accent text-white' : 'hover:bg-primary text-text-secondary disabled:text-text-secondary'
                }`}
                aria-label="Good response"
            >
                <ThumbUpIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => handleFeedback('bad')}
                disabled={!!feedback}
                className={`p-1.5 rounded-full transition-colors ${
                    feedback === 'bad' ? 'bg-red-500 text-white' : 'hover:bg-primary text-text-secondary disabled:text-text-secondary'
                }`}
                aria-label="Bad response"
            >
                <ThumbDownIcon className="w-4 h-4" />
            </button>
        </div>
    );
};
