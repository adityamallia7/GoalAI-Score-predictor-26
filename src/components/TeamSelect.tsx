import React, { useState, useRef, useEffect } from 'react';
import { Team } from '../types';
import TeamFlag from './TeamFlag';
import { ChevronDown, Search } from 'lucide-react';

interface TeamSelectProps {
  id: string;
  teams: Team[];
  selectedCode: string;
  onChange: (code: string) => void;
  excludeCode?: string;
}

export default function TeamSelect({ id, teams, selectedCode, onChange, excludeCode }: TeamSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<HTMLButtonElement[]>([]);

  const selectedTeam = teams.find(t => t.code === selectedCode) || teams[0];

  const filteredTeams = teams
    .filter(t => t.code !== excludeCode)
    .filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Sync highlightedIndex when dropdown opens or active selection changes
  useEffect(() => {
    if (isOpen) {
      const idx = filteredTeams.findIndex(t => t.code === selectedCode);
      setHighlightedIndex(idx !== -1 ? idx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Adjust highlight when text search reduces/changes the filtered list
  useEffect(() => {
    if (isOpen && filteredTeams.length > 0) {
      if (highlightedIndex >= filteredTeams.length) {
        setHighlightedIndex(0);
      } else if (highlightedIndex < 0) {
        setHighlightedIndex(0);
      }
    }
  }, [filteredTeams, isOpen]);

  // Scroll active item into view during arrow-key navigation
  useEffect(() => {
    if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex].scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
      });
    }
  }, [highlightedIndex]);

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          if (filteredTeams.length === 0) return -1;
          const next = prev + 1;
          return next >= filteredTeams.length ? 0 : next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          if (filteredTeams.length === 0) return -1;
          const next = prev - 1;
          return next < 0 ? filteredTeams.length - 1 : next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredTeams.length) {
          handleSelect(filteredTeams[highlightedIndex].code);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div 
      className="relative w-full text-left" 
      ref={containerRef} 
      id={`team-select-container-${id}`}
      onKeyDown={handleKeyDown}
    >
      {/* Selector Button with carbon stadium accent hover */}
      <button
        type="button"
        id={`team-select-button-${id}`}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-zinc-900/90 hover:bg-zinc-850 border border-white/10 rounded-xl py-3 px-4 flex items-center justify-between text-left focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-slate-100 cursor-pointer shadow-md min-w-0"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 pr-2">
          {/* Flag 24px tall */}
          <TeamFlag name={selectedTeam.name} height={24} className="rounded-sm border border-white/5 flex-shrink-0" />
          <span className="font-sans font-bold text-xs sm:text-sm tracking-tight text-white truncate min-w-0 flex-1">{selectedTeam.name}</span>
          <span className="text-[9px] sm:text-[10px] font-mono font-medium text-slate-500 tracking-wider flex-shrink-0">({selectedTeam.confederation})</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating Dropdown List */}
      {isOpen && (
        <div
          id={`team-select-dropdown-${id}`}
          className="absolute z-50 left-0 right-0 mt-2 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden max-h-72 flex flex-col backdrop-blur-xl"
        >
          {/* Search Box */}
          <div className="p-3 border-b border-zinc-900/60 flex items-center gap-2 bg-zinc-950/60">
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-slate-100 text-sm font-sans focus:outline-none focus:ring-0 placeholder:text-slate-500"
              autoFocus
            />
          </div>

          {/* List options */}
          <div className="overflow-y-auto flex-1 divide-y divide-zinc-900/40">
            {filteredTeams.length === 0 ? (
              <div className="p-4 text-xs font-mono text-slate-500 text-center">
                No matching teams found
              </div>
            ) : (
              filteredTeams.map((t, idx) => {
                const isSelected = t.code === selectedCode;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={t.code}
                    ref={(el) => {
                      if (el) optionRefs.current[idx] = el;
                    }}
                    type="button"
                    id={`select-option-${t.code}`}
                    onClick={() => handleSelect(t.code)}
                    className={`w-full p-3.5 flex items-center gap-3 transition-colors text-left cursor-pointer ${
                      isHighlighted 
                        ? 'bg-emerald-500/20 text-white' 
                        : isSelected 
                          ? 'bg-zinc-900/80 text-white' 
                          : 'hover:bg-emerald-500/10 text-slate-300'
                    }`}
                  >
                    {/* Flag 24px tall */}
                    <TeamFlag name={t.name} height={24} className="rounded-xs border border-white/5 flex-shrink-0" />
                    <div className="flex-1 flex items-baseline justify-between">
                      <span className="text-sm font-sans font-semibold text-slate-200">{t.name}</span>
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{t.confederation}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
