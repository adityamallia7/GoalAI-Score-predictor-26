import React, { useState } from 'react';
import { Team, HistoricalChampion } from '../types';
import { HISTORICAL_CHAMPIONS, HISTORICAL_H2H_RECORDS } from '../data/teams';
import TeamSelect from './TeamSelect';
import { History, Award, BookOpen, Scale, Sparkles, Star, Milestone, ShieldAlert } from 'lucide-react';

interface HistoricalExplorerProps {
  teams: Team[];
}

export default function HistoricalExplorer({ teams }: HistoricalExplorerProps) {
  const [selectedCompA, setSelectedCompA] = useState<string>('ARG');
  const [selectedCompB, setSelectedCompB] = useState<string>('BRA');

  const teamA = teams.find(t => t.code === selectedCompA) || teams[0];
  const teamB = teams.find(t => t.code === selectedCompB) || teams[1];

  // Head to head record finder
  const getH2HRecord = (codeA: string, codeB: string) => {
    const key1 = `${codeA}-${codeB}`;
    const key2 = `${codeB}-${codeA}`;
    const h2h = HISTORICAL_H2H_RECORDS[key1] || HISTORICAL_H2H_RECORDS[key2];
    
    if (!h2h) return null;
    
    // Check order
    const isAFirst = HISTORICAL_H2H_RECORDS[key1] !== undefined;
    return {
      played: h2h.played,
      winsA: isAFirst ? h2h.winsA : h2h.winsB,
      winsB: isAFirst ? h2h.winsB : h2h.winsA,
      draws: h2h.draws,
      goalsA: isAFirst ? h2h.goalsA : h2h.goalsB,
      goalsB: isAFirst ? h2h.goalsB : h2h.goalsA,
    };
  };

  const h2hRecord = getH2HRecord(selectedCompA, selectedCompB);

  return (
    <div className="space-y-8" id="history-workspace">
      
      {/* Tab Panel Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Side-by-Side Team Stat Compare Terminal */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-880 p-5 rounded-2xl space-y-6" id="h2h-terminal">
          <div className="flex items-center gap-2.5 border-b border-slate-850 pb-3">
            <Scale className="w-5 h-5 text-emerald-400" />
            <div>
              <h4 className="font-sans font-bold text-slate-100 text-sm">H2H Performance Terminal</h4>
              <p className="text-[11px] font-mono text-slate-500 uppercase">Compare historical records of elite nations</p>
            </div>
          </div>

          {/* Quick Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1.5">Select First Nation</label>
              <TeamSelect
                id="compA"
                teams={teams}
                selectedCode={selectedCompA}
                onChange={(code) => setSelectedCompA(code)}
                excludeCode={selectedCompB}
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1.5">Select Second Nation</label>
              <TeamSelect
                id="compB"
                teams={teams}
                selectedCode={selectedCompB}
                onChange={(code) => setSelectedCompB(code)}
                excludeCode={selectedCompA}
              />
            </div>
          </div>

          {/* Stats Matrix */}
          <div className="space-y-4 font-mono text-xs pb-2 border-b border-slate-850">
            {/* Headers flags */}
            <div className="grid grid-cols-12 text-center text-sm font-sans font-bold">
              <div className="col-span-4 text-emerald-400 flex items-center justify-center gap-1">
                <span>{teamA.flag}</span>
                <span className="truncate max-w-[80px]" title={teamA.name}>{teamA.name}</span>
              </div>
              <div className="col-span-4 text-[10px] font-mono text-slate-500 self-center uppercase tracking-widest">Team Attributes</div>
              <div className="col-span-4 text-emerald-300 flex items-center justify-center gap-1">
                <span>{teamB.flag}</span>
                <span className="truncate max-w-[80px]" title={teamB.name}>{teamB.name}</span>
              </div>
            </div>

            {/* Overall Rating */}
            <div className="grid grid-cols-12 py-1 items-center border-t border-slate-850/40">
              <div className="col-span-3 text-left font-bold text-slate-350">{teamA.overall}</div>
              <div className="col-span-6 text-center text-[10px] text-slate-500 uppercase tracking-wider">Overall index</div>
              <div className="col-span-3 text-right font-bold text-slate-350">{teamB.overall}</div>
            </div>

            {/* FIFA rank */}
            <div className="grid grid-cols-12 py-1 items-center border-t border-slate-850/40">
              <div className="col-span-3 text-left font-bold text-emerald-400">#{teamA.ranking}</div>
              <div className="col-span-6 text-center text-[10px] text-slate-500 uppercase tracking-wider">FIFA World Ranking</div>
              <div className="col-span-3 text-right font-bold text-emerald-400">#{teamB.ranking}</div>
            </div>

            {/* World Cup Titles */}
            <div className="grid grid-cols-12 py-1 items-center border-t border-slate-850/40">
              <div className="col-span-3 text-left font-bold text-yellow-400">{teamA.titles} 🏆</div>
              <div className="col-span-6 text-center text-[10px] text-slate-500 uppercase tracking-wider">World Cup Trophies</div>
              <div className="col-span-3 text-right font-bold text-yellow-400">{teamB.titles} 🏆</div>
            </div>

            {/* appearances */}
            <div className="grid grid-cols-12 py-1 items-center border-t border-slate-850/40">
              <div className="col-span-3 text-left font-bold text-slate-350">{teamA.appearances} campaigns</div>
              <div className="col-span-6 text-center text-[10px] text-slate-500 uppercase tracking-wider">WC appearances</div>
              <div className="col-span-3 text-right font-bold text-slate-350">{teamB.appearances} campaigns</div>
            </div>

            {/* Tactical Style */}
            <div className="grid grid-cols-12 py-1 items-center border-t border-slate-850/40">
              <div className="col-span-4 text-left text-slate-100 font-sans truncate" title={teamA.tacticalStyle}>{teamA.tacticalStyle}</div>
              <div className="col-span-4 text-center text-[10px] text-slate-500 uppercase tracking-wider">Tactical Blueprint</div>
              <div className="col-span-4 text-right text-slate-100 font-sans truncate" title={teamB.tacticalStyle}>{teamB.tacticalStyle}</div>
            </div>

            {/* Manager */}
            <div className="grid grid-cols-12 py-1 items-center border-t border-slate-850/40">
              <div className="col-span-4 text-left text-slate-300 font-sans truncate" title={teamA.manager}>{teamA.manager}</div>
              <div className="col-span-4 text-center text-[10px] text-slate-500 uppercase tracking-wider">Head Coach</div>
              <div className="col-span-4 text-right text-slate-300 font-sans truncate" title={teamB.manager}>{teamB.manager}</div>
            </div>
          </div>

          {/* Key Players */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-xs bg-slate-950/20 p-4 rounded-xl border border-slate-850/80">
            <div>
              <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Key Players A</span>
              <ul className="space-y-1.5 list-disc pl-4 text-slate-300">
                {teamA.keyPlayers.map((player, idx) => (
                  <li key={idx} className="font-sans leading-tight">
                    {player} {idx === 0 && <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono px-1 rounded ml-1 scale-90">Star</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Key Players B</span>
              <ul className="space-y-1.5 list-disc pl-4 text-slate-300">
                {teamB.keyPlayers.map((player, idx) => (
                  <li key={idx} className="font-sans leading-tight">
                    {player} {idx === 0 && <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono px-1 rounded ml-1 scale-90">Star</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* H2H Historical Matches Seed Lookup */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850/50 space-y-3">
            <h5 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-yellow-500" /> Historic H2H Match Record
            </h5>

            {h2hRecord ? (
              <div className="space-y-3 font-mono">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Match Count: {h2hRecord.played} games</span>
                  <span>Goal ratio: {h2hRecord.goalsA} - {h2hRecord.goalsB}</span>
                </div>

                <div className="h-2 bg-slate-800 rounded-full flex overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${(h2hRecord.winsA / h2hRecord.played) * 100}%` }} title={`${h2hRecord.winsA} wins`} />
                  <div className="bg-slate-600 h-full" style={{ width: `${(h2hRecord.draws / h2hRecord.played) * 100}%` }} title={`${h2hRecord.draws} draws`} />
                  <div className="bg-emerald-300 h-full" style={{ width: `${(h2hRecord.winsB / h2hRecord.played) * 100}%` }} title={`${h2hRecord.winsB} wins`} />
                </div>

                <div className="grid grid-cols-3 text-center text-[10px] text-slate-400">
                  <div>{teamA.code} Wins: <span className="font-bold text-emerald-400">{h2hRecord.winsA}</span></div>
                  <div>Draws: <span className="font-bold text-slate-350">{h2hRecord.draws}</span></div>
                  <div>{teamB.code} Wins: <span className="font-bold text-emerald-400">{h2hRecord.winsB}</span></div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic leading-snug">
                No official head-to-head records are seeded in database logs for {teamA.name} and {teamB.name}. Click the Match Predictor tab to simulate a physical match!
              </p>
            )}

            <div className="text-[9px] text-slate-500 font-mono italic mt-2.5 text-center border-t border-slate-850/40 pt-2">
              Note: Historical records are manually compiled and may not be exhaustive.
            </div>
          </div>
        </div>

        {/* Right Side: World Cup Winners Timeline */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-880 p-5 rounded-2xl space-y-6 flex flex-col h-[525px]" id="champions-card">
          <div className="flex items-center gap-2.5 border-b border-slate-850 pb-3">
            <Award className="w-5 h-5 text-yellow-500" />
            <div>
              <h4 className="font-sans font-bold text-slate-100 text-sm">Championship Logs</h4>
              <p className="text-[11px] font-mono text-slate-500 uppercase">Interactive World Cup Final Timeline</p>
            </div>
          </div>

          <div className="overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800 flex-1 space-y-4">
            {HISTORICAL_CHAMPIONS.map((champ) => (
              <div 
                key={champ.year} 
                className="bg-slate-950/30 border border-slate-850 hover:border-slate-800/80 p-3 rounded-lg text-xs flex gap-3 transition"
              >
                {/* Year tag */}
                <div className="text-center font-mono self-center w-14 border-r border-slate-850 pr-3 flex-shrink-0">
                  <span className="text-sm font-bold text-yellow-500 block leading-none">{champ.year}</span>
                  <span className="text-[9px] text-slate-500 uppercase mt-1 block tracking-wider truncate max-w-[48px]">{champ.host}</span>
                </div>

                {/* Match details */}
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between text-slate-200">
                    <span className="font-sans font-semibold text-slate-100 flex items-center gap-1">
                      👑 {champ.champion}
                    </span>
                    <span className="font-mono text-slate-400 font-bold bg-slate-950/80 px-1.5 rounded">{champ.score}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>Runner-Up: {champ.runnerUp}</span>
                  </div>
                  <div className="text-[9px] text-yellow-500/80 pt-1 border-t border-slate-850/40 flex items-center gap-1 font-semibold uppercase">
                    <Star className="w-3 h-3 text-yellow-500" /> MVP: {champ.mvp}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
