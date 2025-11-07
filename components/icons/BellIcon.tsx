import React from 'react';

export const BellIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className}
        aria-hidden="true">
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM10.5 6a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3zM12 18a3 3 0 003-3h-6a3 3 0 003 3zM10.06 13.438a.75.75 0 01.89-1.212 8.32 8.32 0 003.1 0 .75.75 0 11.89 1.212 9.82 9.82 0 01-4.88 0z" clipRule="evenodd" />
    </svg>
);