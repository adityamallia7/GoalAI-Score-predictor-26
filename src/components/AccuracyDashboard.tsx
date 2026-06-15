import React, { useState } from 'react';
import { StoredPrediction } from '../types';
import { BarChart3, Target, Award, Compass, AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

interface AccuracyDashboardProps {
  predictions: StoredPrediction[];
  onClearHistory: () => void;
}

export default function AccuracyDashboard({ predictions, onClearHistory }: AccuracyDashboardProps) {
  // Only look at resolved predictions, and exclude manual adjustments from accurate math logs
  const resolvedPredictions = predictions.filter(p => p.resolved && !p.manual);
  const N = resolvedPredictions.length;

  let outcomeAccuracy = 0;
  let exactScoreAccuracy = 0;
  let brierScore = 0;

  if (N > 0) {
    let outcomeHits = 0;
    let exactScoreHits = 0;
    let brierSum = 0;

    resolvedPredictions.forEach(p => {
      // 1. Outcome hit rate
      const isOutcomeCorrect = p.predictedOutcome === p.actualOutcome;
      if (isOutcomeCorrect) {
        outcomeHits++;
      }

      // 2. Exact score hit rate
      const isExact = p.predScoreline === p.actualScoreline;
      if (isExact) {
        exactScoreHits++;
      }

      // 3. Brier score calculation
      const f_W = (p.pHome ?? 0) / 100;
      const f_D = (p.pDraw ?? 0) / 100;
      const f_L = (p.pAway ?? 0) / 100;

      let o_W = 0, o_D = 0, o_L = 0;
      if (p.actualOutcome === 'W') o_W = 1;
      else if (p.actualOutcome === 'D') o_D = 1;
      else if (p.actualOutcome === 'L') o_L = 1;

      const singleBrier = Math.pow(f_W - o_W, 2) + Math.pow(f_D - o_D, 2) + Math.pow(f_L - o_L, 2);
      brierSum += singleBrier;
    });

    outcomeAccuracy = (outcomeHits / N) * 100;
    exactScoreAccuracy = (exactScoreHits / N) * 100;
    brierScore = brierSum / N;
  }

  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const handleResetClick = () => {
    if (showConfirmReset) {
      onClearHistory();
      setShowConfirmReset(false);
    } else {
      setShowConfirmReset(true);
      setTimeout(() => setShowConfirmReset(false), 4000);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="accuracy-dashboard-tab">
      
      {/* Title block */}
      <div className="bg-carbon-card border border-white/5 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-12 h-[2px] w-24 carbon-hazard-stripes opacity-20" />
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/25 flex-shrink-0">
            <BarChart3 className="w-6 h-6 text-emerald-455 text-emerald-400 text-glow-emerald" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider font-mono">Performance Analytics</h2>
            <p className="text-xs text-slate-405 font-mono mt-0.5">
              Strict mathematical audit comparing Poisson PMF outputs with actual World Cup match results. <span className="text-amber-400 font-semibold">*Manual overlay adjustments are excluded from the accuracy analytics.*</span>
            </p>
          </div>
        </div>

        {predictions.length > 0 && (
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            {showConfirmReset && (
              <span className="text-[10px] text-red-400 font-mono font-bold animate-pulse uppercase mr-1">Press again to reset</span>
            )}
            <button
              onClick={handleResetClick}
              className={`w-full md:w-auto flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[10px] font-mono tracking-widest uppercase font-black transition-all cursor-pointer shadow-lg border ${
                showConfirmReset
                  ? 'bg-red-500/25 border-red-500/40 text-red-200 hover:bg-red-500/40'
                  : 'bg-gradient-to-r from-zinc-950 to-zinc-90 bg-zinc-950 hover:bg-red-950/40 text-slate-400 hover:text-red-405 border-white/5 hover:border-red-900/50'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${showConfirmReset ? 'animate-spin' : ''}`} />
              {showConfirmReset ? 'Confirm Reset' : 'Reset History'}
            </button>
          </div>
        )}
      </div>

      {/* Small sample warning banner (N < 20) */}
      {N > 0 && N < 20 && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-xl flex items-center gap-3 font-mono text-[11px] leading-relaxed relative overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-500" />
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <span className="font-extrabold uppercase text-amber-400">Sample warning (N={N} &lt; 20)</span> — stats are currently noisy. Accumulate more resolved matches to secure mathematical calibration.
          </div>
        </div>
      )}

      {N === 0 ? (
        <div className="bg-carbon-card border border-white/5 p-12 rounded-2xl text-center space-y-4 max-w-xl mx-auto mt-6 shadow-2xl relative">
          <div className="absolute top-0 inset-x-0 h-0.5 carbon-hazard-stripes opacity-20" />
          <ShieldAlert className="w-12 h-12 text-zinc-700 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-white font-extrabold font-sans uppercase text-xs tracking-wider">No Resolved Data Detected</h3>
            <p className="text-xs text-slate-450 leading-relaxed max-w-sm mx-auto font-sans font-medium">
              Accuracy indicators require completed match scorelines. Navigate to the **Prediction History** ledger, supply actual scores (e.g. "3-0"), and hit resolve.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Three Stat Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 1. Outcome Accuracy KPI */}
            <div className="bg-carbon-card border border-white/5 p-5 rounded-2xl shadow-lg relative overflow-hidden animate-fade-in">
              <div className="absolute top-3 right-3 bg-zinc-950 p-2 rounded-lg border border-white/10">
                <Target className="w-5 h-5 text-emerald-400 text-glow-emerald" />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">Outcome Accuracy</p>
              <h3 className="text-4xl font-extrabold text-white mt-4 tracking-tight font-mono text-glow-emerald">
                {outcomeAccuracy.toFixed(1)}%
              </h3>
              <p className="text-xs text-slate-405 mt-2 font-sans font-medium">
                Percentage of resolved predictions where overall outcome (Win/Draw/Loss) matched perfectly.
              </p>
              <div className="w-full bg-zinc-950 h-1.5 rounded-full mt-4 overflow-hidden border border-white/5">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${outcomeAccuracy}%` }}
                />
              </div>
            </div>

            {/* 2. Exact Score Hit Rate KPI */}
            <div className="bg-carbon-card border border-white/5 p-5 rounded-2xl shadow-lg relative overflow-hidden animate-fade-in">
              <div className="absolute top-3 right-3 bg-zinc-950 p-2 rounded-lg border border-white/10">
                <Award className="w-5 h-5 text-yellow-500" />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">Exact Score Hit Rate</p>
              <h3 className="text-4xl font-extrabold text-slate-200 mt-4 tracking-tight font-mono">
                {exactScoreAccuracy.toFixed(1)}%
              </h3>
              <p className="text-xs text-slate-405 mt-2 font-sans font-medium">
                Percentage of matches where predicted score matched actual scoreline exactly.
              </p>
              <div className="w-full bg-zinc-950 h-1.5 rounded-full mt-4 overflow-hidden border border-white/5">
                <div 
                  className="bg-yellow-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${exactScoreAccuracy}%` }}
                />
              </div>
            </div>

            {/* 3. Brier Score KPI */}
            <div className="bg-carbon-card border border-white/5 p-5 rounded-2xl shadow-lg relative overflow-hidden animate-fade-in">
              <div className="absolute top-3 right-3 bg-zinc-950 p-2 rounded-lg border border-white/10">
                <Compass className="w-5 h-5 text-teal-400" />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">Brier Score Calibration</p>
              <h3 className="text-4xl font-extrabold text-white mt-4 tracking-tight font-mono">
                {brierScore.toFixed(3)}
              </h3>
              <p className="text-xs text-teal-400 mt-1.5 font-mono text-[10px] font-black uppercase tracking-wider leading-none">
                (Lower = Better)
              </p>
              <p className="text-xs text-slate-415 mt-2 font-sans font-medium">
                Validates joint probability distribution. <span className="font-bold text-white">Random guessing ≈ 0.667. Under which the model matches noise.</span>
              </p>
            </div>

          </div>

          {/* Model Status Card */}
          <div className="bg-zinc-950/30 border border-white/5 p-6 rounded-2xl space-y-4">
            <h4 className="text-[11px] font-mono uppercase tracking-widest text-slate-350 flex items-center gap-2 border-b border-white/5 pb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 text-glow-emerald" /> Mathematical Forecast Evaluation
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-relaxed text-xs sm:text-sm">
              <div className="space-y-3 font-sans">
                <p className="text-slate-300">
                  The Multi-Category Brier score measures the mean squared difference between predicted probabilities and the actual outcome. A lower score signifies that the Poisson estimator assigns high probabilities to outcomes that realistically occur, verifying the calibration quality of our simulated rating engine.
                </p>
                <div className="bg-zinc-950 border border-white/5 px-3 py-2 rounded-xl text-xs font-mono inline-block">
                  <span className="text-slate-455 font-bold text-[10px] uppercase tracking-wider">Total Evaluated (N):</span> <span className="text-emerald-400 font-black font-mono text-xs sm:text-sm select-all">{N} resolved fixtures</span>
                </div>
              </div>

              <div className="bg-zinc-950/60 p-5 rounded-xl border border-white/5 space-y-3 text-xs text-slate-400 font-mono">
                <p className="font-extrabold text-slate-205 uppercase tracking-widest text-[9px] mb-1">Calibration Standards:</p>
                <div className="space-y-1 bg-zinc-950 p-2.5 rounded border border-white/5 bg-zinc-950">
                  <p>• <span className="text-emerald-400 font-semibold">Brier &lt; 0.500</span>: High-accuracy forecasting, strongly beating random. </p>
                  <p>• <span className="text-sky-400 font-bold">Brier 0.500 – 0.667</span>: Mildly predictive performance. </p>
                  <p>• <span className="text-rose-455 font-black text-rose-400">Brier &ge; 0.667</span>: Counter-predictive. Worse than random guess. </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
