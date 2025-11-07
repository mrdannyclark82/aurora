import React from 'react';

export const PlaneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M21.928 11.599l-7.22-6.42a2.25 2.25 0 00-2.84.346l-4.16 6.11-3.32-1.375a.75.75 0 00-.85.343L2.003 14.1a.75.75 0 00.44 1.004l4.133 1.292 2.763 4.057a.75.75 0 001.272.06l1.21-2.42 6.786 2.69a.75.75 0 00.86-.242l2.453-3.834a.75.75 0 00-.244-.962l-6.24-3.51 4.521-6.638a.75.75 0 01.946-.115l2.25 1.06a.75.75 0 00.95-.563l.36-1.551a.75.75 0 00-.737-.887z" />
  </svg>
);
