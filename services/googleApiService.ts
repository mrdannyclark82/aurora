const googleApiProxyFetch = async (action: string, accessToken: string, params: object) => {
    const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            service: 'google',
            action,
            ...params
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `An error occurred with the Google API proxy for action: ${action}.`);
    }
    return response.json();
};


export const fetchUnreadGmailMessages = async (accessToken: string, maxResults: number = 5) => {
    return googleApiProxyFetch('fetchUnreadGmail', accessToken, { maxResults });
};

export const fetchCalendarEvents = async (accessToken: string, timeMin?: string, maxResults: number = 10) => {
    const now = timeMin || new Date().toISOString();
    return googleApiProxyFetch('fetchCalendarEvents', accessToken, { timeMin: now, maxResults });
};

export const createCalendarEvent = async (accessToken: string, event: any) => {
    return googleApiProxyFetch('createCalendarEvent', accessToken, { event });
};

export const searchDriveFiles = async (accessToken: string, query: string, maxResults: number = 5) => {
    return googleApiProxyFetch('searchDriveFiles', accessToken, { query, maxResults });
};

export const getDriveFileContent = async (accessToken: string, fileId: string, mimeType: string) => {
    return googleApiProxyFetch('getDriveFileContent', accessToken, { fileId, mimeType });
};

export const fetchYouTubeLikedVideos = async (accessToken: string, maxResults: number = 12) => {
    return googleApiProxyFetch('fetchYouTubeLikedVideos', accessToken, { maxResults });
};