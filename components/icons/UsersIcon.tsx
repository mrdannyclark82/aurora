import React from 'react';

export const UsersIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className}
        aria-hidden="true">
        <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM5.25 15.375a3.75 3.75 0 013.75-3.75h.75a3.75 3.75 0 013.75 3.75v.375a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-.375zM14.25 15.375a3.75 3.75 0 013.75-3.75h.75a3.75 3.75 0 013.75 3.75v.375a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-.375z" />
    </svg>
);
