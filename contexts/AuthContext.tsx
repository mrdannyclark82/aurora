import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GoogleUser } from '../types';
import { useError } from './ErrorContext';

// Fix: Added a global declaration for the 'google' object to resolve the TypeScript error 'Cannot find name 'google''.
declare const google: any;

// IMPORTANT: Replace with your actual Google Client ID
const GOOGLE_CLIENT_ID = '472743349101-ilgktbq3a2il4lvucntgi1hshabpbj7h.apps.googleusercontent.com';

const GOOGLE_API_SCOPES = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.readonly',
].join(' ');


interface AuthContextType {
    user: GoogleUser | null;
    accessToken: string | null;
    signIn: () => void;
    signOut: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<GoogleUser | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isGsiLoaded, setIsGsiLoaded] = useState(false);
    const { setError } = useError();

    const tokenClientRef = React.useRef<any>(null);

    const signIn = useCallback(() => {
        if (tokenClientRef.current) {
            tokenClientRef.current.requestAccessToken();
        } else {
            setError('Google Sign-In is not ready. Please try again in a moment.');
            console.error('Google Token Client not initialized.');
        }
    }, [setError]);

    const signOut = useCallback(() => {
        setUser(null);
        setAccessToken(null);
    }, []);
    
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => setIsGsiLoaded(true);
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    useEffect(() => {
        if (isGsiLoaded) {
            try {
                 tokenClientRef.current = google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: GOOGLE_API_SCOPES,
                    callback: (tokenResponse: any) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            setAccessToken(tokenResponse.access_token);
                            fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                headers: {
                                    'Authorization': `Bearer ${tokenResponse.access_token}`
                                }
                            })
                            .then(async (res) => {
                                // Safely parse the response body (may be empty or malformed)
                                try {
                                    const text = await res.text();
                                    if (!text) throw new Error('Empty response when fetching user info');
                                    const userInfo = JSON.parse(text) as { name: string; email: string; picture: string; };
                                    setUser({
                                        name: userInfo.name,
                                        email: userInfo.email,
                                        picture: userInfo.picture,
                                    });
                                } catch (err) {
                                    console.error("Error parsing user info response:", err);
                                    setError("Failed to fetch your Google user information.");
                                }
                            })
                            .catch(err => {
                                console.error("Error fetching user info:", err);
                                setError("Failed to fetch your Google user information.");
                            });
                        }
                    },
                });
            } catch (error) {
                console.error("Error initializing Google token client", error);
                setError("Could not initialize Google Sign-In.");
            }
        }
    }, [isGsiLoaded, setError]);

    return (
        <AuthContext.Provider value={{ user, accessToken, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};