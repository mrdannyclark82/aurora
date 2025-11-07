import React from 'react';

export const ToolboxIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className}>
        <path d="M20.7 7.23a1 1 0 0 0-.6-.23H18V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v1H3.9a1 1 0 0 0-.6.23L1 10.5V17a1 1 0 0 0 1 1h1V7.5a.5.5 0 0 1 .5-.5h17a.5.5 0 0 1 .5.5V18h1a1 1 0 0 0 1-1v-6.5l-2.3-3.27z"/>
        <path d="M4 18h16v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2z"/>
    </svg>
);