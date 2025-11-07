import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Workspace {
    id: string;
    name: string;
    icon: string;
}

interface WorkspaceContextType {
    workspaces: Workspace[];
    activeWorkspace: Workspace | null;
    switchWorkspace: (id: string) => void;
}

const mockWorkspaces: Workspace[] = [
    { id: 'personal', name: 'Personal', icon: '👤' },
    { id: 'work', name: 'Work Project', icon: '💼' },
];

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [workspaces] = useState<Workspace[]>(mockWorkspaces);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('personal');

    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || null;

    const switchWorkspace = (id: string) => {
        setActiveWorkspaceId(id);
    };

    return (
        <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, switchWorkspace }}>
            {children}
        </WorkspaceContext.Provider>
    );
};

export const useWorkspace = (): WorkspaceContextType => {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
};
