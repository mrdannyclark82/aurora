import React from 'react';
import { MicIcon } from './icons/MicIcon';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';

/**
 * Live voice/video conversation is temporarily disabled.
 *
 * The previous implementation opened a Gemini Live session directly from the browser,
 * which required shipping GEMINI_API_KEY inside the client bundle. That leaked the key.
 * Re-enable this once the server can mint short-lived ephemeral tokens for the Live API
 * (e.g. a new /api/proxy action) so no long-lived key ever reaches the browser.
 * The original implementation is available in git history.
 */
export const LiveView: React.FC = () => {
    const { toggleMobileNav } = useMobileNav();

    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">Live Conversation</h2>
                    <p className="text-sm text-text-secondary">Talk to and show Aura things in real-time.</p>
                </div>
            </header>
            <main className="flex-1 flex items-center justify-center p-6">
                <div className="text-center text-text-secondary max-w-md" role="status">
                    <MicIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold text-text-primary">Live voice is temporarily unavailable</h3>
                    <p className="mt-2 text-sm">
                        Real-time voice conversations are disabled while we move them to a secure server-side
                        connection. You can still chat with Aura in the Chat view.
                    </p>
                </div>
            </main>
        </div>
    );
};
