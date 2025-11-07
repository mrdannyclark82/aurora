import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorProvider } from './contexts/ErrorContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { CommandPaletteProvider } from './contexts/CommandPaletteContext';
import { MobileNavProvider } from './contexts/MobileNavContext';
import { ChangelogProvider } from './contexts/ChangelogContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ErrorProvider>
      <AuthProvider>
        <ChangelogProvider>
          <WorkspaceProvider>
            <SettingsProvider>
              <CommandPaletteProvider>
                <MobileNavProvider>
                  <NotificationProvider>
                    <App />
                  </NotificationProvider>
                </MobileNavProvider>
              </CommandPaletteProvider>
            </SettingsProvider>
          </WorkspaceProvider>
        </ChangelogProvider>
      </AuthProvider>
    </ErrorProvider>
  </React.StrictMode>
);