import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ErrorContextType {
  error: string | null;
  setError: (message: string | null) => void;
  clearError: () => void;
}

const ErrorContext = createContext<ErrorContextType | null>(null);

export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [error, setErrorState] = useState<string | null>(null);

  const setError = useCallback((message: string | null) => {
    setErrorState(message);
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  return (
    <ErrorContext.Provider value={{ error, setError, clearError }}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useError = (): ErrorContextType => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};