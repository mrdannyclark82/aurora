import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type NotificationPermission = 'default' | 'granted' | 'denied';

interface NotificationContextType {
    isSupported: boolean;
    permission: NotificationPermission;
    requestPermission: () => Promise<void>;
    scheduleNotification: (title: string, body: string, timestamp: number) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if ('Notification' in window && 'serviceWorker' in navigator) {
            setIsSupported(true);
            setPermission(Notification.permission as NotificationPermission);

            // Register service worker
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            }).catch(error => {
                console.error('Service Worker registration failed:', error);
            });
        }
    }, []);

    const requestPermission = useCallback(async () => {
        if (!isSupported) return;

        const result = await Notification.requestPermission();
        setPermission(result);
    }, [isSupported]);
    
    const scheduleNotification = useCallback((title: string, body: string, timestamp: number) => {
        if (permission !== 'granted' || !navigator.serviceWorker.ready) {
            console.warn('Cannot schedule notification: permission not granted or service worker not ready.');
            return;
        }

        const delay = timestamp - Date.now();
        if (delay <= 0) return; // Don't schedule for past events

        console.log(`Scheduling notification "${title}" in ${Math.round(delay / 1000)} seconds.`);

        // This is a client-side simulation. A real app would send a push from a server.
        // We use setTimeout to trigger a notification via the service worker at the desired time.
        setTimeout(() => {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    body: body,
                    icon: '/icon-192.png', // From manifest
                    tag: `event-${timestamp}` // Use a tag to prevent duplicate notifications
                });
            });
        }, delay);

    }, [permission]);

    return (
        <NotificationContext.Provider value={{ isSupported, permission, requestPermission, scheduleNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};