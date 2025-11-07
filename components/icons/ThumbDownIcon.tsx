import React from 'react';

export const ThumbDownIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 20 20" 
        fill="currentColor" 
        className={className}
        aria-hidden="true">
        <path d="M19 11.75a1.25 1.25 0 11-2.5 0v-7.5a1.25 1.25 0 112.5 0v7.5zM1.132 10.464a2.493 2.493 0 002.29 1.786H6.5v3.5a2.25 2.25 0 002.25 2.25L9.5 18a.75.75 0 00.75-.75v-3.44l1.636-3.863.057-.133a.75.75 0 00-.379-1.004l-.01-.005h-6.5a2.5 2.5 0 00-2.446 2.056l-.248 1.186z" />
    </svg>
);
