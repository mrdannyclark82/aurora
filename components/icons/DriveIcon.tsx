import React from 'react';

export const DriveIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className}>
        <path d="M7.71 5.43L12 12l4.29-6.57A1 1 0 0 0 15.43 4H8.57a1 1 0 0 0-.86 1.43z"/>
        <path d="M15.86 13H8.14a1 1 0 0 0-.86 1.43L11.57 21a1 1 0 0 0 1.71 0l4.29-6.57a1 1 0 0 0-.85-1.43z"/>
        <path d="M6.57 6.43L2 14l4.57 7.57a1 1 0 0 0 .86-.43h0a1 1 0 0 0 .14-1L3.71 13l3.72-6.14a1 1 0 0 0-.14-1a1 1 0 0 0-.72-.43z"/>
    </svg>
);