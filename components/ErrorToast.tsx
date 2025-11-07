import React, { useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import { CloseIcon } from './icons/CloseIcon';

export const ErrorToast: React.FC = () => {
  const { error, clearError } = useError();

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 6000); // Auto-dismiss after 6 seconds

      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  if (!error) {
    return null;
  }

  return (
    <div
      role="alert"
      className="fixed bottom-5 right-5 z-50 w-full max-w-sm p-4 rounded-lg bg-red-500 text-white shadow-lg animate-fade-in"
    >
      <div className="flex items-start">
        <div className="flex-1 text-sm font-medium">
          <p><strong>Error:</strong> {error}</p>
        </div>
        <button
          onClick={clearError}
          aria-label="Dismiss error message"
          className="ml-4 p-1 rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};