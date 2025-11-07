import React from 'react';

export const ThumbUpIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 20 20" 
        fill="currentColor" 
        className={className}
        aria-hidden="true">
        <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM18.868 9.536a2.493 2.493 0 00-2.29-1.786H13.5V4.25a2.25 2.25 0 00-2.25-2.25L10.5 2a.75.75 0 00-.75.75v3.44l-1.636 3.863-.057.133a.75.75 0 00.379 1.004l.01.005h6.5a2.5 2.5 0 002.446-2.056l.248-1.186z" />
    </svg>
);
