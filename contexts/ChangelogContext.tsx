import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { APP_VERSION } from '../version';

interface ChangelogContextType {
    isChangelogVisible: boolean;
    showChangelog: () => void;
    hideChangelog: () => void;
}

const ChangelogContext = createContext<ChangelogContextType | null>(null);

const LAST_SEEN_VERSION_KEY = 'aura_last_seen_version';

export const ChangelogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isChangelogVisible, setIsChangelogVisible] = useState(false);

    useEffect(() => {
        const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY);
        if (lastSeenVersion !== APP_VERSION) {
            setIsChangelogVisible(true);
        }
    }, []);

    const showChangelog = () => setIsChangelogVisible(true);
    
    const hideChangelog = () => {
        setIsChangelogVisible(false);
        localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    };

    return (
        <ChangelogContext.Provider value={{ isChangelogVisible, showChangelog, hideChangelog }}>
            {children}
        </ChangelogContext.Provider>
    );
};

export const useChangelog = (): ChangelogContextType => {
    const context = useContext(ChangelogContext);
    if (!context) {
        throw new Error('useChangelog must be used within a ChangelogProvider');
    }
    return context;
};
