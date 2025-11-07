
import React from 'react';

export const MapIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M8.161 2.58a1.875 1.875 0 012.652 0l1.897 1.897a.75.75 0 001.06 0l2.122-2.121a.75.75 0 011.061 0l2.12 2.12a.75.75 0 010 1.061l-2.12 2.12a.75.75 0 000 1.06l1.897 1.898a1.875 1.875 0 010 2.652l-6.096 6.096a1.875 1.875 0 01-2.652 0L2.065 15.68a1.875 1.875 0 010-2.652l6.096-6.096zM12 18a6 6 0 100-12 6 6 0 000 12z"
      clipRule="evenodd"
    />
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
  </svg>
);
