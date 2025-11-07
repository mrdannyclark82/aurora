import React from 'react';

export const FilmIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 2v3h3V6H4zm5 0v3h3V6H9zm5 0v3h3V6h-3zM4 11v3h3v-3H4zm5 0v3h3v-3H9zm5 0v3h3v-3h-3z" />
  </svg>
);