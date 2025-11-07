import React from 'react';

export const DashboardSkeleton: React.FC = () => (
    <div className="animate-pulse">
        <div className="h-8 w-1/2 bg-primary rounded-md mb-2"></div>
        <div className="h-5 w-1/3 bg-primary rounded-md mb-8"></div>

        <div className="bg-primary p-6 rounded-lg">
            <div className="h-6 w-1/4 bg-secondary rounded-md mb-6"></div>
            <div className="space-y-3">
                <div className="h-4 bg-secondary rounded-md"></div>
                <div className="h-4 w-5/6 bg-secondary rounded-md"></div>
                <div className="h-4 bg-secondary rounded-md"></div>
                <div className="h-4 w-3/4 bg-secondary rounded-md"></div>
                 <div className="h-4 w-1/2 bg-secondary rounded-md mt-4"></div>
                <div className="h-4 bg-secondary rounded-md"></div>
                 <div className="h-4 w-5/6 bg-secondary rounded-md"></div>
            </div>
        </div>
    </div>
);