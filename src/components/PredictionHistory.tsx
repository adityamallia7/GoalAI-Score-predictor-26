import React, { useState } from 'react';
import { StoredPrediction } from '../types';
import { History, Trash2, Calendar, Save, X, HelpCircle, AlertCircle } from 'lucide-react';
import TeamFlag from './TeamFlag';

interface PredictionHistoryProps {
  predictions: StoredPrediction[];
  onUpdateActualScore: (id: string, actualScoreline: string) => void;
  onClearHistory: () => void;
}

export default function PredictionHistory({
  predictions,
  onUpdateActualScore,
  onClearHistory
}: PredictionHistoryProps) {
  // To track the text input for resolving predictions
  const [resolveInputs, setResolveInputs] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorIds, setErrorIds] = useState<Record<string, string>>({});
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const handleClearClick = () => {
    if (showConfirmClear) {
      onClearHistory();
      setShowConfirmClear(false);
    } else {
      setShowConfirmClear(true);
      setTimeout(() => setShowConfirmClear(false), 4000);
    }
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  const getPredictionStatus = (pred: StoredPrediction) => {
    if (!pred.resolved || !pred.actualScoreline) {
      return { label: 'Awaiting Result', style: 'text-slate-400 bg-slate-800 border-slate-700/50' };
    }

    const actual = pred.actualScoreline.trim();

    // If top3Scores list exists, check proximity ranking
    if (pred.top3Scores && pred.top3Scores.length >= 3) {
      if (actual === pred.top3Scores[0]) {
        return { label: 'Exact Hit 🎯', style: 'text-emerald-305 bg-emerald-500/25 border-emerald-500/30 font-bold' };
      } else if (actual === pred.top3Scores[1]) {
        return { label: 'Close — 2nd most likely', style: 'text-cyan-300 bg-cyan-500/20 border-cyan-500/30' };
      } else if (actual === pred.top3Scores[2]) {
        return { label: 'Close — 3rd most likely', style: 'text-indigo-300 bg-indigo-550/20 border-indigo-500/30' };
      } else if (pred.predictedOutcome === pred.actualOutcome) {
        return { label: 'Outcome Correct ✓', style: 'text-sky-305 bg-sky-505/20 border-sky-500/30' };
      } else {
        return { label: 'Incorrect ✗', style: 'text-red-400 bg-red-500/10 border-red-500/20' };
      }
    }

    // Fallback for older saved history logs
    const isExact = pred.predScoreline === actual;
    const isOutcomeCorrect = pred.predictedOutcome === pred.actualOutcome;

    if (isExact) {
      return { label: 'Exact Hit 🎯', style: 'text-emerald-305 bg-emerald-500/25 border-emerald-500/30 font-bold' };
    } else if (isOutcomeCorrect) {
      return { label: 'Outcome Correct ✓', style: 'text-sky-305 bg-sky-505/20 border-sky-500/30' };
    } else {
      return { label: 'Incorrect ✗', style: 'text-red-400 bg-red-500/10 border-red-500/20' };
    }
  };

  const handleResolve = (id: string) => {
    const value = resolveInputs[id] || '';
    
    // Regular expression to validate standard scoreline "X-Y", where X and Y are positive integers
    const match = value.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (!match) {
      setErrorIds(prev => ({ ...prev, [id]: 'Please enter a valid format, e.g. 2-1' }));
      return;
    }

    const scoreA = parseInt(match[1], 10);
    const scoreB = parseInt(match[2], 10);

    if (isNaN(scoreA) || isNaN(scoreB)) {
      setErrorIds(prev => ({ ...prev, [id]: 'Invalid numeric score' }));
      return;
    }

    // Clean scoreline string to "X-Y" standard form
    const cleanScoreline = `${scoreA}-${scoreB}`;

    // Clear any previous error and trigger callback
    setErrorIds(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    onUpdateActualScore(id, cleanScoreline);
    setEditingId(null);
  };

  const startEditing = (pred: StoredPrediction) => {
    setEditingId(pred.id);
    setResolveInputs(prev => ({ ...prev, [pred.id]: pred.actualScoreline || pred.predScoreline }));
  };

  return (
    <div className="space-y-6 animate-fade-in" id="prediction-history-tab">
      
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-carbon-card border border-white/5 p-5 rounded-2xl shadow-xl relative">
        <div className="absolute top-0 right-6 -translate-y-1/2 px-2.5 py-0.5 rounded bg-zinc-950 border border-white/5 text-[9px] font-mono text-slate-500 font-bold uppercase tracking-widest">
          Database Ledger
        </div>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/25">
            <History className="w-6 h-6 text-emerald-455 text-emerald-400 text-glow-emerald animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">My Predictions</h2>
            <p className="text-xs text-slate-405 font-mono mt-0.5">
              History logs: <span className="text-emerald-405 font-bold text-glow-emerald">{predictions.length}</span> scorelines simulated
            </p>
          </div>
        </div>

        {predictions.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {showConfirmClear && (
              <span className="text-[10px] text-red-400 font-mono font-bold animate-pulse uppercase mr-1">Press again to confirm</span>
            )}
            <button
              id="clear-all-history-btn"
              onClick={handleClearClick}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[10px] font-mono transition-all font-black uppercase tracking-wider cursor-pointer shadow-lg border ${
                showConfirmClear
                  ? 'bg-red-500/25 border-red-500/40 text-red-200 hover:bg-red-500/40'
                  : 'bg-gradient-to-r from-red-950/40 to-zinc-950 hover:from-red-900/40 hover:to-red-950 text-slate-400 hover:text-red-400 border border-red-900/50 hover:border-red-500/30'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" /> {showConfirmClear ? 'Confirm Clear' : 'Clear History Logs'}
            </button>
          </div>
        )}
      </div>

      {predictions.length === 0 ? (
        <div className="bg-carbon-card border border-white/5 p-12 rounded-2xl text-center space-y-4 max-w-xl mx-auto mt-6 shadow-2xl relative">
          <div className="absolute top-0 inset-x-0 h-0.5 carbon-hazard-stripes opacity-20" />
          <HelpCircle className="w-12 h-12 text-zinc-750 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-white font-extrabold font-sans uppercase text-xs tracking-wider">No Predictions Saved</h3>
            <p className="text-xs text-slate-450 leading-relaxed max-w-sm mx-auto font-sans font-medium">
              You haven't generated any Poisson score predictions yet. Head over to the **Match Predictor**, perform a match simulation, and we'll automatically log it here!
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-carbon-card border border-white/5 rounded-2xl overflow-hidden shadow-2xl" id="predictions-table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="bg-zinc-950/90 border-b border-white/5 text-slate-400 font-mono text-[9px] uppercase tracking-widest font-black">
                  <th className="py-4.5 px-5 hidden md:table-cell">Simulation Date</th>
                  <th className="py-4.5 px-5">Fixture Match</th>
                  <th className="py-4.5 px-5 text-center">Predicted score</th>
                  <th className="py-4.5 px-5 text-center hidden sm:table-cell">Outcome Probabilities</th>
                  <th className="py-4.5 px-5 text-center">Actual score</th>
                  <th className="py-4.5 px-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {predictions.map((pred) => {
                  const status = getPredictionStatus(pred);
                  const isEditing = editingId === pred.id;
                  const isRowUnresolved = !pred.resolved;

                  return (
                    <tr key={pred.id} className="hover:bg-zinc-900/35 transition duration-300 text-sm text-slate-200">
                      
                      {/* Date */}
                      <td className="py-4 px-5 font-mono text-[11px] text-slate-400 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {formatTimestamp(pred.timestamp)}
                        </div>
                      </td>

                      {/* Teams / Flags */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <TeamFlag name={pred.teamA.name} height={20} className="shadow-md rounded-xs border border-white/10" />
                          <span className="font-bold tracking-tight text-white hidden sm:inline">{pred.teamA.name}</span>
                          <span className="font-bold tracking-tight text-white sm:hidden">{pred.teamA.code}</span>
                          <span className="text-zinc-650 font-mono text-[10px] font-black px-1 select-none">VS</span>
                          <TeamFlag name={pred.teamB.name} height={20} className="shadow-md rounded-xs border border-white/10" />
                          <span className="font-bold tracking-tight text-white hidden sm:inline">{pred.teamB.name}</span>
                          <span className="font-bold tracking-tight text-white sm:hidden">{pred.teamB.code}</span>
                        </div>
                      </td>

                      {/* Predicted Scoreline */}
                      <td className="py-4 px-5 text-center font-mono">
                        <div className="inline-block bg-zinc-950 border border-white/5 px-3 py-1 rounded-lg text-emerald-400 font-extrabold text-glow-emerald text-xs">
                          {pred.predScoreline}
                        </div>
                        {pred.manual && (
                          <div className="text-[9px] text-amber-500 font-bold uppercase mt-1 tracking-wider opacity-90 select-none">
                            Custom Run
                          </div>
                        )}
                      </td>

                      {/* Probabilities Home/Draw/Away */}
                      <td className="py-4 px-5 text-center font-mono text-xs text-slate-450 hidden sm:table-cell">
                        <div className="inline-flex items-center gap-1.5 bg-zinc-950/80 border border-white/5 px-2.5 py-1 rounded-lg text-[10px]">
                          <span className="text-emerald-440 font-bold" title="Home Advantage win percentage">{(pred.pHome ?? 0).toFixed(0)}%</span>
                          <span className="text-zinc-700 font-black">/</span>
                          <span className="text-slate-300">{(pred.pDraw ?? 0).toFixed(0)}%</span>
                          <span className="text-zinc-700 font-black">/</span>
                          <span className="text-indigo-400" title="Away Advantage win percentage">{(pred.pAway ?? 0).toFixed(0)}%</span>
                        </div>
                      </td>

                      {/* Actual Score Inputs / Resolution Actions */}
                      <td className="py-4 px-5 text-center">
                        {isRowUnresolved && !isEditing ? (
                          <button
                            onClick={() => startEditing(pred)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-all hover:scale-[1.03] active:scale-95 cursor-pointer select-none"
                          >
                            Resolve score
                          </button>
                        ) : isEditing ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center justify-center gap-1 px-1.5 py-1.5 bg-zinc-950 rounded-lg border border-white/10 max-w-[150px] mx-auto">
                              <input
                                type="text"
                                placeholder="e.g. 2-1"
                                value={resolveInputs[pred.id] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setResolveInputs(prev => ({ ...prev, [pred.id]: val }));
                                }}
                                className="w-16 bg-zinc-900 rounded border border-white/5 text-center text-xs font-mono text-white px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleResolve(pred.id);
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleResolve(pred.id)}
                                className="p-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded transition cursor-pointer"
                                title="Resolve prediction"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 bg-zinc-800 hover:bg-zinc-700 text-slate-400 rounded transition cursor-pointer"
                                title="Cancel editing"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            {errorIds[pred.id] && (
                              <div className="flex items-center gap-1 text-[9px] text-red-405 font-mono mt-1 max-w-[150px] leading-tight">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                {errorIds[pred.id]}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xs font-black font-mono text-white text-glow-emerald">
                              {pred.actualScoreline}
                            </span>
                            <button
                              onClick={() => startEditing(pred)}
                              className="text-[10px] text-emerald-400 hover:text-emerald-350 underline font-mono mt-1"
                            >
                              Edit Score
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Status badge representation */}
                      <td className="py-4 px-5 text-center">
                        <span className={`inline-block border px-2.5 py-1 rounded text-[9px] font-mono font-black uppercase tracking-wider leading-none select-none ${status.style}`}>
                          {status.label}
                        </span>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
