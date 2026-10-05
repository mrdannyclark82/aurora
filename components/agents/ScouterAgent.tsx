import React, { useState } from 'react';
import { SearchIcon } from '../icons/SearchIcon';

export const ScouterAgent: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setResults([
        `Scouted AI Tech: ${query} Integration v2.4 (Optimized UX)`,
        `Recommended Model: Aura-Max-Pro (Latency: 120ms)`,
        `Advanced Pattern: Autonomous Agentic RAG with Stream-UI`
      ]);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="p-4 bg-surface border border-border rounded-xl space-y-4">
      <div className="flex items-center space-x-2">
        <SearchIcon className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-text">Scouter Agent (Tech & UX Discovery)</h3>
      </div>
      <div className="flex space-x-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search latest AI models, UX patterns..."
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-text"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90"
        >
          {loading ? 'Scouting...' : 'Scout'}
        </button>
      </div>
      {results.length > 0 && (
        <div className="space-y-2 mt-4">
          {results.map((res, idx) => (
            <div key={idx} className="p-3 bg-background border border-border rounded-lg text-xs text-text-secondary">
              {res}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};