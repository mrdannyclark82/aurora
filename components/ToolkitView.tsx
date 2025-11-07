import React, { useState } from 'react';
import { ImageGenerationTool } from './tool-views/ImageGenerationTool';
import { CodeGenerationTool } from './tool-views/CodeGenerationTool';
import { TextUtilitiesTool } from './tool-views/TextUtilitiesTool';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';

type Tool = 'image' | 'code' | 'text';

export const ToolkitView: React.FC = () => {
    const [activeTool, setActiveTool] = useState<Tool>('image');
    const { toggleMobileNav } = useMobileNav();

    const renderTool = () => {
        switch (activeTool) {
            case 'image':
                return <ImageGenerationTool />;
            case 'code':
                return <CodeGenerationTool />;
            case 'text':
                return <TextUtilitiesTool />;
            default:
                return <ImageGenerationTool />;
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md:hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">AI Toolkit</h2>
                    <p className="text-sm text-text-secondary">A collection of powerful creative and developer tools.</p>
                </div>
            </header>
            <nav className="flex p-2 bg-primary border-b border-border overflow-x-auto">
                <ToolTab name="Image Generation" tool="image" activeTool={activeTool} setActiveTool={setActiveTool} />
                <ToolTab name="Code Generation" tool="code" activeTool={activeTool} setActiveTool={setActiveTool} />
                <ToolTab name="Text Utilities" tool="text" activeTool={activeTool} setActiveTool={setActiveTool} />
            </nav>
            <main className="flex-1 overflow-y-auto">
                {renderTool()}
            </main>
        </div>
    );
};

interface ToolTabProps {
    name: string;
    tool: Tool;
    activeTool: Tool;
    setActiveTool: (tool: Tool) => void;
}

const ToolTab: React.FC<ToolTabProps> = ({ name, tool, activeTool, setActiveTool }) => {
    const isActive = activeTool === tool;
    return (
        <button
            onClick={() => setActiveTool(tool)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors shrink-0 ${
                isActive ? 'bg-accent text-white' : 'text-text-secondary hover:bg-secondary'
            }`}
        >
            {name}
        </button>
    );
};
