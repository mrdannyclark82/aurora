import React from 'react';

export const VideoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}>
    <path d="M21 6.333H3C2.448 6.333 2 6.781 2 7.333V18c0 .552.448 1 1 1h18c.552 0 1-.448 1-1V7.333C22 6.781 21.552 6.333 21 6.333zM9 16V8l6 4-6 4z" />
    <path d="M5 4h14a1 1 0 0 1 1 1v.333a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
  </svg>
);