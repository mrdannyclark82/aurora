import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface MobileNavContextType {
    isMobileNavOpen: boolean;
    toggleMobileNav: () => void;
}

const MobileNavContext = createContext<MobileNavContextType | null>(null);

export const MobileNavProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const toggleMobileNav = useCallback(() => setIsMobileNavOpen(prev => !prev), []);

    return (
        <MobileNavContext.Provider value={{ isMobileNavOpen, toggleMobileNav }}>
            {children}
        </MobileNavContext.Provider>
    );
};

export const useMobileNav = (): MobileNavContextType => {
    const context = useContext(MobileNavContext);
    if (!context) {
        throw new Error('useMobileNav must be used within a MobileNavProvider');
    }
    return context;
};
