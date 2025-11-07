import React from 'react';

export const PaperclipIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.5 10.5a.75.75 0 001.061 1.061L17.41 4.16a.75.75 0 011.06 0c.3.3.3.785 0 1.085l-7.5 7.5a2.25 2.25 0 01-3.182 0 2.25 2.25 0 010-3.182l7.5-7.5a.75.75 0 00-1.06-1.06l-7.5 7.5a3.75 3.75 0 105.303 5.303l7.5-7.5a.75.75 0 00-1.06-1.06l-1.061 1.06a2.25 2.25 0 01-3.182-3.182l1.06-1.061a.75.75 0 00-1.06-1.061l-1.06 1.06a3.75 3.75 0 105.304 5.303l10.5-10.5a.75.75 0 00-1.06-1.06z"
      clipRule="evenodd"
    />
  </svg>
);