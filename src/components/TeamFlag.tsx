import React, { useState, useEffect } from 'react';

export const TEAM_ISO_MAP: Record<string, string> = {
  "Canada": "ca",
  "Mexico": "mx",
  "United States": "us",
  "Australia": "au",
  "Iran": "ir",
  "Iraq": "iq",
  "Japan": "jp",
  "Jordan": "jo",
  "South Korea": "kr",
  "Qatar": "qa",
  "Saudi Arabia": "sa",
  "Uzbekistan": "uz",
  "Algeria": "dz",
  "Cabo Verde": "cv",
  "DR Congo": "cd",
  "Côte d'Ivoire": "ci",
  "Egypt": "eg",
  "Ghana": "gh",
  "Morocco": "ma",
  "Senegal": "sn",
  "South Africa": "za",
  "Tunisia": "tn",
  "Curaçao": "cw",
  "Haiti": "ht",
  "Panama": "pa",
  "Argentina": "ar",
  "Brazil": "br",
  "Colombia": "co",
  "Ecuador": "ec",
  "Paraguay": "py",
  "Uruguay": "uy",
  "New Zealand": "nz",
  "Austria": "at",
  "Belgium": "be",
  "Bosnia and Herzegovina": "ba",
  "Croatia": "hr",
  "Czechia": "cz",
  "England": "gb-eng",
  "France": "fr",
  "Germany": "de",
  "Netherlands": "nl",
  "Norway": "no",
  "Portugal": "pt",
  "Scotland": "gb-sct",
  "Spain": "es",
  "Sweden": "se",
  "Switzerland": "ch",
  "Türkiye": "tr"
};

interface TeamFlagProps {
  name: string;
  height?: number; // e.g. 24
  className?: string;
}

export default function TeamFlag({ name, height = 24, className = "" }: TeamFlagProps) {
  const [error, setError] = useState(false);
  const [iso, setIso] = useState<string | undefined>(undefined);

  useEffect(() => {
    setError(false);
    setIso(TEAM_ISO_MAP[name]);
  }, [name]);

  // Asserting we have the iso definition
  if (!iso) {
    const approxIso = name.slice(0, 2).toUpperCase();
    return (
      <span className={`text-[9px] font-mono font-bold text-slate-400 border border-slate-700 bg-slate-800 px-1 py-0.5 rounded-xs select-none ${className}`} style={{ fontSize: `${Math.max(8, height - 10)}px` }}>
        {approxIso}
      </span>
    );
  }

  if (error) {
    return (
      <span className={`text-[9px] font-mono font-bold text-slate-400 border border-slate-700 bg-slate-800 px-1 py-0.5 rounded-xs select-none ${className}`} style={{ fontSize: `${Math.max(8, height - 10)}px` }}>
        {iso.toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${iso}.png`}
      alt={name}
      style={{ height: `${height}px`, width: 'auto', display: 'inline-block' }}
      className={`object-contain rounded-xs select-none flex-shrink-0 ${className}`}
      onError={() => {
        console.warn(`Failed to load flag for team: ${name} (${iso})`);
        setError(true);
      }}
      referrerPolicy="no-referrer"
    />
  );
}
