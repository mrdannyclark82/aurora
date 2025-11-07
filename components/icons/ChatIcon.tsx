
import React from 'react';

export const ChatIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M4.804 21.644A6.707 6.707 0 011.05 15.932V4.5A2.25 2.25 0 013.3 2.25h17.4A2.25 2.25 0 0123.04 4.5v11.432a2.25 2.25 0 01-2.25 2.25H9.421a.75.75 0 00-.53.22L4.804 21.644z"
      clipRule="evenodd"
    />
  </svg>
);
