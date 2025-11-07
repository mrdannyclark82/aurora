import React from 'react';

export const StarIcon: React.FC<{ className?: string; filled: boolean }> = ({ className, filled }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={`${className} ${filled ? 'text-yellow-400' : 'text-gray-500'}`}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M10.868 2.884c.321-.662 1.215-.662 1.536 0l1.681 3.468 3.82.556c.734.107 1.028.995.494 1.512l-2.764 2.693.652 3.803c.124.722-.642 1.282-1.295.942L10 13.484l-3.419 1.797c-.653.34-1.42-.22-1.295-.942l.652-3.803-2.764-2.693c-.534-.517-.24-1.405.494-1.512l3.82-.556 1.681-3.468z"
      clipRule="evenodd"
    />
  </svg>
);
