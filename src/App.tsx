import React, { useState, useEffect, useRef } from 'react';
import { ENRICHED_TEAMS as TEAMS } from './utils/predictor';
import MatchPredictor from './components/MatchPredictor';
import PredictionHistory from './components/PredictionHistory';
import AccuracyDashboard from './components/AccuracyDashboard';
import TournamentSimulator from './components/TournamentSimulator';
import HistoricalExplorer from './components/HistoricalExplorer';
import { StoredPrediction } from './types';
import { Swords, History, BarChart3, Trophy, Star, Info, ChevronDown, BookOpen } from 'lucide-react';

function migratePredictions(raw: any[]): StoredPrediction[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(p => {
    if (!p || typeof p !== 'object') return null;
    
    // Check if it's already in the correct new format
    if ('predScoreline' in p && 'pHome' in p && 'pDraw' in p && 'pAway' in p) {
      return p as StoredPrediction;
    }

    const oldP = p as any;
    
    let predScoreline = '0-0';
    if (typeof oldP.predScoreline === 'string') {
      predScoreline = oldP.predScoreline;
    } else if (typeof oldP.predictedScoreA === 'number' && typeof oldP.predictedScoreB === 'number') {
      predScoreline = `${oldP.predictedScoreA}-${oldP.predictedScoreB}`;
    }

    let pHome = 0;
    let pDraw = 0;
    let pAway = 0;
    if (typeof oldP.pHome === 'number') {
      pHome = oldP.pHome;
    } else if (oldP.probabilities && typeof oldP.probabilities.winA === 'number') {
      pHome = oldP.probabilities.winA * 100;
    }

    if (typeof oldP.pDraw === 'number') {
      pDraw = oldP.pDraw;
    } else if (oldP.probabilities && typeof oldP.probabilities.draw === 'number') {
      pDraw = oldP.probabilities.draw * 100;
    }

    if (typeof oldP.pAway === 'number') {
      pAway = oldP.pAway;
    } else if (oldP.probabilities && typeof oldP.probabilities.winB === 'number') {
      pAway = oldP.probabilities.winB * 100;
    }

    let predictedOutcome: 'W' | 'D' | 'L' = 'D';
    if (typeof oldP.predictedOutcome === 'string') {
      predictedOutcome = oldP.predictedOutcome;
    } else {
      const parts = predScoreline.split('-');
      const pA = parseInt(parts[0], 10);
      const pB = parseInt(parts[1], 10);
      if (!isNaN(pA) && !isNaN(pB)) {
        if (pA > pB) predictedOutcome = 'W';
        else if (pA < pB) predictedOutcome = 'L';
      }
    }

    let actualScoreline: string | null = null;
    if (typeof oldP.actualScoreline === 'string') {
      actualScoreline = oldP.actualScoreline;
    } else if (oldP.actualScoreline === null) {
      actualScoreline = null;
    } else if (typeof oldP.actualScoreA === 'number' && typeof oldP.actualScoreB === 'number') {
      actualScoreline = `${oldP.actualScoreA}-${oldP.actualScoreB}`;
    }

    let actualOutcome: 'W' | 'D' | 'L' | null = null;
    if (typeof oldP.actualOutcome === 'string') {
      actualOutcome = oldP.actualOutcome;
    } else if (actualScoreline) {
      const parts = actualScoreline.split('-');
      const aA = parseInt(parts[0], 10);
      const aB = parseInt(parts[1], 10);
      if (!isNaN(aA) && !isNaN(aB)) {
        if (aA > aB) actualOutcome = 'W';
        else if (aA < aB) actualOutcome = 'L';
        else actualOutcome = 'D';
      }
    }

    let resolved = false;
    if (typeof oldP.resolved === 'boolean') {
      resolved = oldP.resolved;
    } else {
      resolved = actualScoreline !== null;
    }

    return {
      id: oldP.id || Math.random().toString(36).substring(2, 9),
      timestamp: oldP.timestamp || new Date().toISOString(),
      teamA: oldP.teamA,
      teamB: oldP.teamB,
      predScoreline,
      pHome,
      pDraw,
      pAway,
      predictedOutcome,
      actualScoreline,
      actualOutcome,
      resolved
    } as StoredPrediction;
  }).filter((p): p is StoredPrediction => p !== null);
}

export default function App() {
  const [activeTab, setActiveTab2] = useState<'predict' | 'tournament' | 'history' | 'explorer'>('predict');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [predictions, setPredictions] = useState<StoredPrediction[]>(() => {
    try {
      const saved = localStorage.getItem('worldcup_predictions_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        return migratePredictions(parsed);
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('worldcup_predictions_history', JSON.stringify(predictions));
    } catch (err) {
      console.error('Failed to save predictions to localStorage:', err);
    }
  }, [predictions]);

  const handlePredictionSaved = (pred: StoredPrediction) => {
    setPredictions(prev => [pred, ...prev]);
  };

  const handleUpdateActualScore = (id: string, actualScoreline: string) => {
    setPredictions(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        
        const [scoreA, scoreB] = actualScoreline.split('-').map(Num => parseInt(Num.trim(), 10));
        let actualOutcome: 'W' | 'D' | 'L' | null = null;
        if (!isNaN(scoreA) && !isNaN(scoreB)) {
          if (scoreA > scoreB) actualOutcome = 'W';
          else if (scoreA < scoreB) actualOutcome = 'L';
          else actualOutcome = 'D';
        }

        return {
          ...p,
          actualScoreline,
          actualOutcome,
          resolved: true
        };
      })
    );
  };

  const handleClearHistory = () => {
    setPredictions([]);
  };

  if (TEAMS.length !== 48) {
    return (
      <div className="min-h-screen bg-[#05070B] text-slate-100 flex flex-col items-center justify-center font-mono p-6">
        <div className="bg-[#0B0F19] border border-[#1E293B] p-8 rounded-2xl text-center space-y-4 max-w-md shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
            <span className="text-red-400 text-3xl font-bold font-outfit">!</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-red-400 font-outfit">Team Roster Validation Failed</h1>
            <p className="text-xs text-slate-400">
              The required quantity of qualified teams is exactly 48.
            </p>
          </div>
          <div className="bg-[#05070B] p-3 rounded-lg text-xs border border-[#1E293B] font-mono">
            Current Count: <span className="text-[#A3E635] font-bold">{TEAMS.length}</span> teams built.
          </div>
          <p className="text-[11px] text-slate-500">
            Please verify the configured TS array conforms to the World Cup 2026 specifications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070B] bg-stadium-carbon text-slate-100 flex flex-col justify-between font-sans selection:bg-[#A3E635]/30 selection:text-[#A3E635]">
      
      {/* Primary Navigation Header conforming strictly to Stitch Design */}
      <header className="bg-[#05070B] border-b border-[#1E293B] px-6 py-4 select-none relative">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo / Wordmark */}
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black tracking-tight font-outfit text-[#A3E635] select-all cursor-pointer">GoalAI</span>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-8 font-outfit text-[15px] font-bold">
            <button
              onClick={() => setActiveTab2('predict')}
              className={`pb-1 transition-colors relative focus:outline-none ${
                activeTab === 'predict' ? 'text-[#06B6D4]' : 'text-slate-400 hover:text-[#06B6D4]'
              }`}
            >
              Predictor
              {activeTab === 'predict' && (
                <span className="absolute bottom-[-17px] left-0 right-0 h-[2.5px] bg-[#A3E635] rounded-full animate-fade-in" />
              )}
            </button>
            <button
              onClick={() => setActiveTab2('tournament')}
              className={`pb-1 transition-colors relative focus:outline-none ${
                activeTab === 'tournament' ? 'text-[#06B6D4]' : 'text-slate-400 hover:text-[#06B6D4]'
              }`}
            >
              Tournament
              {activeTab === 'tournament' && (
                <span className="absolute bottom-[-17px] left-0 right-0 h-[2.5px] bg-[#A3E635] rounded-full animate-fade-in" />
              )}
            </button>
            <button
              onClick={() => setActiveTab2('history')}
              className={`pb-1 transition-colors relative focus:outline-none ${
                activeTab === 'history' ? 'text-[#06B6D4]' : 'text-slate-400 hover:text-[#06B6D4]'
              }`}
            >
              History
              {activeTab === 'history' && (
                <span className="absolute bottom-[-17px] left-0 right-0 h-[2.5px] bg-[#A3E635] rounded-full animate-fade-in" />
              )}
            </button>
            <button
              onClick={() => setActiveTab2('explorer')}
              className={`pb-1 transition-colors relative focus:outline-none ${
                activeTab === 'explorer' ? 'text-[#06B6D4]' : 'text-slate-400 hover:text-[#06B6D4]'
              }`}
            >
              Explorer
              {activeTab === 'explorer' && (
                <span className="absolute bottom-[-17px] left-0 right-0 h-[2.5px] bg-[#A3E635] rounded-full animate-fade-in" />
              )}
            </button>
          </nav>

          {/* Mobile Tab Select Dropdown */}
          <div className="relative md:hidden self-stretch flex items-center" ref={dropdownRef} id="nav-dropdown-container">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              type="button"
              className="px-4 py-2 bg-[#0B0F19] border border-[#1E293B] rounded-xl flex items-center gap-2.5 text-slate-250 cursor-pointer font-outfit text-sm font-bold select-none focus:outline-none focus:ring-1 focus:ring-[#A3E635]"
            >
              <span className="text-[#06B6D4]">
                {activeTab === 'predict' && "Predictor"}
                {activeTab === 'tournament' && "Tournament"}
                {activeTab === 'history' && "History"}
                {activeTab === 'explorer' && "Explorer"}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {isDropdownOpen && (
              <div
                className="absolute z-50 right-0 top-12 w-48 bg-[#0B0F19] border border-[#1E293B] rounded-xl shadow-2xl overflow-hidden focus:outline-none animate-fade-in"
                id="nav-dropdown-menu"
              >
                <div className="p-1.5 space-y-1">
                  <button
                    onClick={() => {
                      setActiveTab2('predict');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-outfit text-left transition-colors cursor-pointer select-none ${
                      activeTab === 'predict' ? 'bg-[#A3E635] text-slate-950 font-bold' : 'text-slate-300 hover:bg-[#05070B]'
                    }`}
                  >
                    Predictor
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab2('tournament');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-outfit text-left transition-colors cursor-pointer select-none ${
                      activeTab === 'tournament' ? 'bg-[#A3E635] text-slate-950 font-bold' : 'text-slate-300 hover:bg-[#05070B]'
                    }`}
                  >
                    Tournament
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab2('history');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-outfit text-left transition-colors cursor-pointer select-none ${
                      activeTab === 'history' ? 'bg-[#A3E635] text-slate-950 font-bold' : 'text-slate-300 hover:bg-[#05070B]'
                    }`}
                  >
                    History
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab2('explorer');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-outfit text-left transition-colors cursor-pointer select-none ${
                      activeTab === 'explorer' ? 'bg-[#A3E635] text-slate-950 font-bold' : 'text-slate-300 hover:bg-[#05070B]'
                    }`}
                  >
                    Explorer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Clean User Profile HUD Icon */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border border-[#1E293B] flex items-center justify-center text-slate-400">
              <Star className="w-4 h-4 text-[#A3E635] fill-[#A3E635]" />
            </div>
          </div>

        </div>
      </header>

      {/* Main Workspace Area with exact responsive sizing */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6" id="main-content-workspace">
        
        {/* Tab contents */}
        <div className="animate-fade-in">
          {activeTab === 'predict' && (
            <MatchPredictor teams={TEAMS} onPredictionSaved={handlePredictionSaved} />
          )}
          {activeTab === 'history' && (
            <div className="space-y-8" id="combined-history-dashboard">
              {/* Analytics HUD component renders the visual metrics */}
              <AccuracyDashboard predictions={predictions} onClearHistory={handleClearHistory} />
              
              {/* Prediction History element renders the list container */}
              <PredictionHistory 
                predictions={predictions} 
                onUpdateActualScore={handleUpdateActualScore} 
                onClearHistory={handleClearHistory} 
              />
            </div>
          )}
          {activeTab === 'tournament' && (
            <TournamentSimulator teams={TEAMS} />
          )}
          {activeTab === 'explorer' && (
            <HistoricalExplorer teams={TEAMS} />
          )}
        </div>
      </main>

      {/* Simplified, Honest Footer conforming strictly to client specs */}
      <footer className="border-t border-[#1E293B] px-6 py-8 bg-[#05070B] font-outfit text-xs text-slate-500 text-center select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400">Ratings approximated from FIFA June 2026 rankings.</p>
          <div className="flex gap-4 text-slate-500 text-[11px]">
            <a href="#terms" className="hover:text-slate-400">Terms</a>
            <a href="#privacy" className="hover:text-slate-400">Privacy</a>
            <a href="#sources" className="hover:text-slate-400">Data Sources</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
