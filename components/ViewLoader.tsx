import React from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';

export const ViewLoader: React.FC = () => (
  <div className="flex h-full w-full items-center justify-center bg-secondary">
    <SpinnerIcon className="h-10 w-10 animate-spin text-accent" />
  </div>
);
