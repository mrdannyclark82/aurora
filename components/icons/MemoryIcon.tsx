import React from 'react';

export const MemoryIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className}
        aria-hidden="true">
        <path d="M15 2H9v2H7v2H5v12h2v2h2v2h6v-2h2v-2h2V6h-2V4h-2V2zM9 16H7v-2h2v2zm0-4H7v-2h2v2zm0-4H7V6h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V6h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2z"/>
    </svg>
);
