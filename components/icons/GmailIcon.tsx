import React from 'react';

export const GmailIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className}>
        <path d="M22 5.5H2v13h20v-13zm-2.001 1.501L12 12.251 4.001 7.002h15.998zM3.5 17V8.652l8.501 5.666L20.5 8.652V17h-17z"/>
    </svg>
);
