import React, { useState, useEffect } from 'react';
import { Team, MatchSimulationConfig, MatchPredictionResult, StoredPrediction } from '../types';
import { Swords, Activity, Flame, ShieldAlert, Award, Timer, BookOpen, AlertCircle, BarChart2, Hash, Percent, HelpCircle, ChevronDown } from 'lucide-react';
import TeamSelect from './TeamSelect';
import TeamFlag from './TeamFlag';
import Markdown from 'react-markdown';
import { simulateMatch } from '../utils/predictor';
import remarkGfm from 'remark-gfm';

interface MatchPredictorProps {
  teams: Team[];
  onPredictionSaved?: (pred: StoredPrediction) => void;
}

export default function MatchPredictor({ teams, onPredictionSaved }: MatchPredictorProps) {
  // Assert length === 48. Block rendering if not.
  if (teams.length !== 48) {
    return (
      <div className="bg-red-950/40 border border-red-900/60 p-8 rounded-2xl text-center space-y-4 max-w-md mx-auto my-12 font-mono">
        <h1 className="text-xl font-bold text-red-400 flex items-center justify-center gap-2">
          <ShieldAlert className="w-6 h-6" /> Team Validation Error
        </h1>
        <p className="text-sm text-slate-300">
          The application requires exactly <span className="text-white font-bold">48</span> teams to operate. Found: <span className="text-red-400 font-bold">{teams.length}</span>.
        </p>
      </div>
    );
  }

  // Alphabetical sort for dropdown selectors
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  const [teamACode, setTeamACode] = useState<string>('ARG');
  const [teamBCode, setTeamBCode] = useState<string>('FRA');

  // Tactics details
  const [tacticsA, setTacticsA] = useState<string>('Standard');
  const [tacticsB, setTacticsB] = useState<string>('Standard');
  const [formWeight, setFormWeight] = useState<number>(0.5);
  const [injurySeverityA, setInjurySeverityA] = useState<number>(0);
  const [injurySeverityB, setInjurySeverityB] = useState<number>(0);
  const [hostToggle, setHostToggle] = useState<boolean>(false);

  // New tactical overlay multipliers (Section 3)
  const [squadFormA, setSquadFormA] = useState<number>(1.0);
  const [squadFormB, setSquadFormB] = useState<number>(1.0);
  const [tacticalSetupA, setTacticalSetupA] = useState<number>(1.0);
  const [tacticalSetupB, setTacticalSetupB] = useState<number>(1.0);
  const [crowdSupportA, setCrowdSupportA] = useState<number>(1.0);
  const [crowdSupportB, setCrowdSupportB] = useState<number>(1.0);

  // Status simulation
  const [loading, setLoading] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<MatchPredictionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [tacticalOpen, setTacticalOpen] = useState<boolean>(false);

  const teamA = teams.find(t => t.code === teamACode) || teams[0];
  const teamB = teams.find(t => t.code === teamBCode) || teams[1];

  // Prevent selection of identical teams
  useEffect(() => {
    if (teamACode === teamBCode) {
      const remaining = teams.find(t => t.code !== teamACode);
      if (remaining) setTeamBCode(remaining.code);
    }
  }, [teamACode, teamBCode, teams]);

  const handlePredict = async () => {
    setLoading(true);
    setErrorMessage('');
    setPrediction(null);

    const isManual = squadFormA !== 1.0 || tacticalSetupA !== 1.0 || crowdSupportA !== 1.0 ||
                     squadFormB !== 1.0 || tacticalSetupB !== 1.0 || crowdSupportB !== 1.0;

    const config: MatchSimulationConfig = {
      teamA: teamACode,
      teamB: teamBCode,
      tacticsA,
      tacticsB,
      formWeight,
      injurySeverityA,
      injurySeverityB,
      neutralGround: !hostToggle,
      hostToggle: hostToggle,
      squadFormMultiplierA: squadFormA,
      squadFormMultiplierB: squadFormB,
      tacticalSetupMultiplierA: tacticalSetupA,
      tacticalSetupMultiplierB: tacticalSetupB,
      crowdSupportMultiplierA: crowdSupportA,
      crowdSupportMultiplierB: crowdSupportB,
      manual: isManual
    };

    // Calculate prediction client-side instantly!
    const clientPrediction = simulateMatch(config);
    setPrediction(clientPrediction);

    if (onPredictionSaved) {
      // Find most likely exact score (modal scoreline) from prediction matrix
      let maxP = -1;
      let pA = 0;
      let pB = 0;
      for (let a = 0; a <= 8; a++) {
        for (let b = 0; b <= 8; b++) {
          const prob = clientPrediction.scoreMatrix[a]?.[b] || 0;
          if (prob > maxP) {
            maxP = prob;
            pA = a;
            pB = b;
          }
        }
      }

      let predOutcome: 'W' | 'D' | 'L' = 'D';
      if (pA > pB) predOutcome = 'W';
      else if (pA < pB) predOutcome = 'L';

      const stored: StoredPrediction = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        teamA: clientPrediction.teamA,
        teamB: clientPrediction.teamB,
        predScoreline: `${pA}-${pB}`, // Save modal scoreline
        pHome: parseFloat((clientPrediction.probabilities.winA * 100).toFixed(1)),
        pDraw: parseFloat((clientPrediction.probabilities.draw * 100).toFixed(1)),
        pAway: parseFloat((clientPrediction.probabilities.winB * 100).toFixed(1)),
        predictedOutcome: predOutcome, // from Team A perspective
        actualScoreline: null,
        resolved: false,
        manual: isManual
      };
      onPredictionSaved(stored);
    }

    setLoading(false);
  };

  const getComparisonWidths = (valA: number, valB: number) => {
    const total = valA + valB;
    return {
      widthA: `${(valA / total) * 100}%`,
      widthB: `${(valB / total) * 100}%`
    };
  };

  // Extract most likely exact score matrix statistics for display
  let maxProb = -1;
  let modalA = 0;
  let modalB = 0;
  let sumOver3 = 0;
  const allScorelines: { score: string; prob: number }[] = [];

  if (prediction?.scoreMatrix) {
    for (let a = 0; a <= 8; a++) {
      for (let b = 0; b <= 8; b++) {
        const prob = prediction.scoreMatrix[a]?.[b] || 0;
        allScorelines.push({ score: `${a}-${b}`, prob });

        if (prob > maxProb) {
          maxProb = prob;
          modalA = a;
          modalB = b;
        }

        if (a + b >= 3) {
          sumOver3 += prob;
        }
      }
    }
  }

  const top3 = [...allScorelines]
    .sort((x, y) => y.prob - x.prob)
    .slice(0, 3);

  return (
    <div className="space-y-8" id="match-predictor-section">
      
      {/* 1. Selector Module with Carbon Composite Stadium Borders */}
      <div className="bg-[#0B0F19] border border-[#1E293B] p-6 rounded-2xl shadow-2xl relative" id="selector-panel">
        
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-6 items-center">
          {/* Team A Custom Selection */}
          <div className="lg:col-span-5 space-y-3" id="team-a-selector-card">
            <label className="block text-xs font-outfit uppercase tracking-widest text-[#06B6D4] font-bold">Team A</label>
            <TeamSelect
              id="teamA"
              teams={sortedTeams}
              selectedCode={teamACode}
              onChange={(code) => setTeamACode(code)}
              excludeCode={teamBCode}
            />
          </div>

          {/* VS Divider */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center py-2 select-none" id="arena-vs-pillar">
            <span className="font-outfit font-black text-xl text-slate-500 italic">VS</span>
          </div>

          {/* Team B Custom Selection */}
          <div className="lg:col-span-5 space-y-3" id="team-b-selector-card">
            <label className="block text-xs font-outfit uppercase tracking-widest text-[#06B6D4] font-bold">Team B</label>
            <TeamSelect
              id="teamB"
              teams={sortedTeams}
              selectedCode={teamBCode}
              onChange={(code) => setTeamBCode(code)}
              excludeCode={teamACode}
            />
          </div>
        </div>

        {/* Action Button & Toggle Container */}
        <div className="mt-8 pt-6 border-t border-[#1E293B] flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Host Advantage Toggle (default OFF) */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none" id="host-toggle-wrapper">
            <input
              type="checkbox"
              checked={hostToggle}
              onChange={(e) => setHostToggle(e.target.checked)}
              className="w-4.5 h-4.5 accent-[#A3E635] bg-[#05070B] border-[#1E293B] rounded focus:ring-0 cursor-pointer"
            />
            <span className="font-outfit text-sm text-slate-300 font-medium tracking-tight">
              Host Advantage Boost <span className="text-[#A3E635] font-semibold">(applicable to USA, MEX, CAN)</span>
            </span>
          </label>

          {/* Glowing lime PREDICT button */}
          <button
            onClick={handlePredict}
            disabled={loading}
            className="w-full md:w-auto bg-[#A3E635] hover:bg-[#b2f048] text-slate-950 font-outfit font-black py-3 px-8 rounded-xl flex items-center justify-center gap-2.5 transition active:scale-98 disabled:opacity-50 cursor-pointer shadow-[0_0_20px_rgba(163,230,53,0.3)] select-none uppercase tracking-wider text-xs border-0"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-xs">Simulating Match...</span>
              </>
            ) : (
              <>
                <Swords className="w-4 h-4 text-slate-950" />
                <span>PREDICT MATCH</span>
              </>
            )}
          </button>
        </div>

        {/* Collapsible Tactical Adjustments Panel */}
        <div className="mt-6 border-t border-[#1E293B] pt-4" id="tactical-panel-container">
          <button
            type="button"
            onClick={() => setTacticalOpen(!tacticalOpen)}
            className="flex items-center justify-between w-full py-2 text-slate-300 hover:text-white font-outfit text-sm font-bold tracking-wide focus:outline-none cursor-pointer border-0 bg-transparent"
          >
            <span>TACTICAL ADJUSTMENTS</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${tacticalOpen ? 'rotate-180' : ''}`} />
          </button>

          {tacticalOpen && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in text-xs font-mono">
              
              {/* Tactical Team A */}
              <div className="bg-[#05070B] p-4 rounded-xl border border-[#1E293B] space-y-4">
                <h4 className="text-slate-400 font-outfit text-xs font-bold uppercase tracking-wider border-b border-[#1E293B] pb-2">
                  {teamA.name} Blueprint
                </h4>
                <div>
                  <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide text-[10px]">Tactical Style</label>
                  <select
                    value={tacticsA}
                    onChange={(e) => setTacticsA(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-[#1E293B] rounded px-3 py-2 text-xs text-slate-250 cursor-pointer focus:outline-none"
                  >
                    <option value="Standard">Standard Pattern (Realistic)</option>
                    <option value="Offensive">Attacking Boost (+15% Attack / -15% Defense)</option>
                    <option value="Defensive">Defensive Shield (+15% Defense / -15% Attack)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1 font-semibold text-[10px]">
                    <span className="text-slate-400">Squad Form multiplier</span>
                    <span className="text-[#A3E635] font-bold font-mono">{squadFormA.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.05"
                    value={squadFormA}
                    onChange={(e) => setSquadFormA(parseFloat(e.target.value))}
                    className="w-full accent-[#A3E635] bg-[#05070B] cursor-pointer h-1.5 rounded-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1 font-semibold text-[10px]">
                    <span className="text-slate-400">Tactical Setup multiplier</span>
                    <span className="text-[#06B6D4] font-bold font-mono">{tacticalSetupA.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.05"
                    value={tacticalSetupA}
                    onChange={(e) => setTacticalSetupA(parseFloat(e.target.value))}
                    className="w-full accent-[#A3E635] bg-[#05070B] cursor-pointer h-1.5 rounded-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1 font-semibold text-[10px]">
                    <span className="text-slate-400">Crowd Support details</span>
                    <span className="text-slate-300 font-bold font-mono">{crowdSupportA.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.05"
                    value={crowdSupportA}
                    onChange={(e) => setCrowdSupportA(parseFloat(e.target.value))}
                    className="w-full accent-[#A3E635] bg-[#05070B] cursor-pointer h-1.5 rounded-full"
                  />
                </div>
              </div>

              {/* Tactical Team B */}
              <div className="bg-[#05070B] p-4 rounded-xl border border-[#1E293B] space-y-4">
                <h4 className="text-slate-400 font-outfit text-xs font-bold uppercase tracking-wider border-b border-[#1E293B] pb-2">
                  {teamB.name} Blueprint
                </h4>
                <div>
                  <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide text-[10px]">Tactical Style</label>
                  <select
                    value={tacticsB}
                    onChange={(e) => setTacticsB(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-[#1E293B] rounded px-3 py-2 text-xs text-slate-250 cursor-pointer focus:outline-none"
                  >
                    <option value="Standard">Standard Pattern (Realistic)</option>
                    <option value="Offensive">Attacking Boost (+15% Attack / -15% Defense)</option>
                    <option value="Defensive">Defensive Shield (+15% Defense / -15% Attack)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1 font-semibold text-[10px]">
                    <span className="text-slate-400">Squad Form multiplier</span>
                    <span className="text-[#A3E635] font-bold font-mono">{squadFormB.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.05"
                    value={squadFormB}
                    onChange={(e) => setSquadFormB(parseFloat(e.target.value))}
                    className="w-full accent-[#A3E635] bg-[#05070B] cursor-pointer h-1.5 rounded-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1 font-semibold text-[10px]">
                    <span className="text-slate-400">Tactical Setup multiplier</span>
                    <span className="text-[#06B6D4] font-bold font-mono">{tacticalSetupB.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.05"
                    value={tacticalSetupB}
                    onChange={(e) => setTacticalSetupB(parseFloat(e.target.value))}
                    className="w-full accent-[#A3E635] bg-[#05070B] cursor-pointer h-1.5 rounded-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1 font-semibold text-[10px]">
                    <span className="text-slate-400">Crowd Support details</span>
                    <span className="text-slate-300 font-bold font-mono">{crowdSupportB.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.2"
                    step="0.05"
                    value={crowdSupportB}
                    onChange={(e) => setCrowdSupportB(parseFloat(e.target.value))}
                    className="w-full accent-[#A3E635] bg-[#05070B] cursor-pointer h-1.5 rounded-full"
                  />
                </div>
              </div>

            </div>
          )}
        </div>

      </div>



      {/* Loading animation state with telemetry elements */}
      {loading && (
        <div className="bg-carbon-card border border-white/5 p-12 rounded-2xl flex flex-col items-center justify-center space-y-6 relative overflow-hidden shadow-2xl text-center" id="analysing-loader">
          <div className="absolute top-0 inset-x-0 h-1 carbon-hazard-stripes opacity-40" />
          <div className="w-16 h-16 rounded-full border-4 border-emerald-500/10 border-t-emerald-500 animate-spin flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Swords className="w-6 h-6 text-emerald-405 animate-pulse" />
          </div>
          <div className="text-center space-y-2 max-w-sm font-mono z-10">
            <h3 className="text-white text-xs tracking-widest uppercase font-black text-glow-emerald">Numerical Poisson Core Initialized</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Fitting historical goals, resolving joint Dixon-Coles parameters, normalizing outcomes, and executing 60,000 game timeline simulations...
            </p>
          </div>
        </div>
      )}

      {/* Error details banner */}
      {errorMessage && (
        <div className="bg-red-950/40 border border-red-855 p-4 rounded-xl flex items-center gap-3 text-red-300 font-mono text-xs">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 3. Prediction Results Screen */}
      {prediction && !loading && (
        <div className="space-y-8 animate-fade-in" id="prediction-results">
          
          {/* Section 4: RESULT DISPLAY (in this exact order) with Carbon Stadium Elements */}
          <div className="bg-carbon-card border border-white/5 p-6 sm:p-8 rounded-2xl shadow-xl space-y-8 stadium-border-glow" id="forecast-scorecard">
            
            {/* Header Badge */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-455 text-emerald-400" />
                <h3 className="font-extrabold text-white text-md tracking-tight font-sans uppercase text-[12px]">Deterministic Forecast Scorecard</h3>
              </div>
              <span className="bg-zinc-950 border border-white/5 px-3 py-1 rounded-md text-[9px] font-mono text-emerald-405 uppercase font-black tracking-widest shadow-inner">
                Poisson Balanced Output
              </span>
            </div>

            {/* EXACT ORDER ITEMS */}
            <div className="space-y-6 max-w-2xl mx-auto">
              
              {/* 1. Expected Goals (decimal, secondary) */}
              <div className="text-center space-y-1.5 font-mono text-xs text-slate-400 py-2.5 bg-zinc-950/40 rounded-xl border border-white/5" id="xg-decimal-secondary">
                <span className="uppercase tracking-widest mr-2 font-black text-slate-500 text-[9px] font-outfit">Expected Goals (xG) Matrix:</span>
                <span className="inline-flex items-center gap-1.5 text-white font-bold">
                  <TeamFlag name={prediction.teamA.name} height={14} className="mr-1 shadow-sm" />
                  {prediction.teamA.name} <span className="text-[#A3E635] font-extrabold text-sm text-glow-emerald">{prediction.expectedGoalsA.toFixed(1)}</span>
                </span>
                <span className="text-zinc-650 mx-3 font-semibold">–</span>
                <span className="inline-flex items-center gap-1.5 text-white font-bold">
                  <span className="text-[#A3E635] font-extrabold text-sm text-glow-emerald">{prediction.expectedGoalsB.toFixed(1)}</span>
                  {prediction.teamB.name}
                  <TeamFlag name={prediction.teamB.name} height={14} className="ml-1 shadow-sm" />
                </span>
              </div>

              {/* 2. Predicted Score (rounded, PRIMARY/large) */}
              <div className="text-center py-6 bg-zinc-950/80 border border-white/5 rounded-2xl relative overflow-hidden stadium-border-glow-intense" id="predicted-score-primary">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.08),transparent_70%)]" />
                
                <p className="text-[10px] font-outfit text-slate-400 uppercase tracking-widest font-black mb-4 relative z-10">
                  Projected Score (from xG)
                </p>

                <div className="flex items-center justify-center gap-1.5 sm:gap-10 relative z-10 w-full px-2">
                  {/* Team A display */}
                  <div className="flex flex-col items-center w-20 sm:w-32 min-w-0 flex-1 max-w-[100px] text-center">
                    <TeamFlag name={prediction.teamA.name} height={32} className="mb-2 shadow-md rounded-sm border border-white/10 flex-shrink-0" />
                    <span className="text-xs font-black text-white font-outfit max-w-full truncate tracking-tight">{prediction.teamA.name}</span>
                  </div>

                  {/* Gigantic Score numbers */}
                  <div className="font-outfit font-black text-4xl sm:text-7xl text-white tracking-tighter tabular-nums flex items-baseline gap-1 sm:gap-5 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex-shrink-0">
                    <span className="text-[#A3E635] text-glow-emerald">{Math.round(prediction.expectedGoalsA)}</span>
                    <span className="text-zinc-700 font-light text-3xl sm:text-4xl select-none">:</span>
                    <span className="text-[#A3E635] text-glow-emerald">{Math.round(prediction.expectedGoalsB)}</span>
                  </div>

                  {/* Team B display */}
                  <div className="flex flex-col items-center w-20 sm:w-32 min-w-0 flex-1 max-w-[100px] text-center">
                    <TeamFlag name={prediction.teamB.name} height={32} className="mb-2 shadow-md rounded-sm border border-white/10 flex-shrink-0" />
                    <span className="text-xs font-black text-white font-outfit max-w-full truncate tracking-tight">{prediction.teamB.name}</span>
                  </div>
                </div>

                {prediction.penaltiesWinner && (
                  <div className="mt-5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 px-4 py-1.5 rounded-full border border-emerald-500/25 inline-block text-[11px] font-mono text-[#A3E635] relative z-10 font-bold uppercase tracking-wider">
                    🏆 Penalties Winner: <span className="font-extrabold text-white text-glow-emerald">{prediction.penaltiesWinner === prediction.teamA.code ? prediction.teamA.name : prediction.teamB.name}</span>
                  </div>
                )}

                {/* Footnote disclaimer */}
                <p className="mt-4 text-[12px] text-[#94A3B8] font-normal relative z-10 block">
                  This is the most statistically likely score, not a guarantee — real match results often differ.
                </p>
              </div>

              {/* 3. Most Likely Exact Score (secondary) */}
              <div className="bg-zinc-950 border border-white/10 px-5 py-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shadow-lg" id="modal-score-secondary">
                <div>
                  <h4 className="text-xs font-outfit font-black text-white uppercase tracking-wider">Most Likely Exact Score</h4>
                  <p className="text-[10px] text-slate-500 font-sans mt-0.5 leading-tight">Argmax modal coordinate count of the normalized joint probability cells.</p>
                </div>
                {/* Scoreline WITH probability percentage explicitly on same row */}
                <div className="inline-flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 py-2 px-4 rounded-xl">
                  <span className="font-mono text-lg font-black text-white tracking-widest">{modalA}–{modalB}</span>
                  <span className="text-zinc-700 font-mono text-xs">·</span>
                  <span className="font-mono text-sm font-black text-[#A3E635] text-glow-emerald">{(maxProb * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* 4. Win / Draw / Loss outcome bars */}
              <div className="space-y-4 pt-2" id="wdl-outcome-bars">
                <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#06B6D4] font-black">Outcome Probability Vectors</span>
                  <div className="h-1 bg-zinc-800 w-16 rounded" />
                </div>

                <div className="space-y-3.5 font-outfit font-medium">
                  {/* Home Win */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-250 flex items-center gap-2 text-slate-300 font-medium font-outfit">
                        <TeamFlag name={prediction.teamA.name} height={14} className="rounded-xs border border-white/10" /> {prediction.teamA.name} Win
                      </span>
                      <span className="text-[#A3E635] text-glow-emerald font-black font-mono">{(prediction.probabilities.winA * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-[#05070B] rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="bg-[#A3E635] h-full rounded-full transition-all duration-500" 
                        style={{ width: `${prediction.probabilities.winA * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Draw */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5 text-slate-400 font-medium">
                      <span>Draw / Stalemate</span>
                      <span className="text-slate-400 font-black font-mono">{(prediction.probabilities.draw * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-[#05070B] rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="bg-slate-700 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${prediction.probabilities.draw * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Away Win */}
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-255 flex items-center gap-2 text-slate-300 font-medium font-outfit">
                        <TeamFlag name={prediction.teamB.name} height={14} className="rounded-xs border border-white/10" /> {prediction.teamB.name} Win
                      </span>
                      <span className="text-[#06B6D4] font-black font-mono">{(prediction.probabilities.winB * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-[#05070B] rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="bg-[#06B6D4] h-full rounded-full transition-all duration-500" 
                        style={{ width: `${prediction.probabilities.winB * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Top 3 Scorelines with % */}
              <div className="space-y-3" id="top-three-scorelines font-mono">
                <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#06B6D4] font-black">Top 3 Likely Score Combinations</span>
                  <Hash className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {top3.map((sl, index) => (
                    <div key={sl.score} className="bg-zinc-950/60 border border-white/5 p-3.5 rounded-xl flex items-center sm:flex-col justify-between sm:justify-center gap-1.5 text-center font-mono hover:border-emerald-500/30 transition duration-300">
                      <span className="text-[9px] text-[#06B6D4] font-bold uppercase tracking-wider font-outfit">Rank #{index + 1}</span>
                      <span className="text-sm font-black text-slate-100">{sl.score}</span>
                      <span className="text-xs font-extrabold text-[#A3E635]">{(sl.prob * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Chance of 3+ Goals (as %) */}
              <div className="bg-zinc-950 border border-white/5 p-4 rounded-xl flex items-center justify-between font-mono text-xs" id="goals-over-under">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[#A3E635] flex-shrink-0" />
                  <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px] font-outfit">Chance of 3+ Goals (Score sum Over 2.5)</span>
                </div>
                <span className="text-sm font-black text-[#A3E635]">{(sumOver3 * 100).toFixed(1)}%</span>
              </div>

            </div>

          </div>

          {/* 9x9 Score Matrix Heatmap & Simulation Highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 9x9 Probability Grid (0-0 through 8-8) */}
            <div className="lg:col-span-12 xl:col-span-7 bg-carbon-card border border-white/5 p-5 rounded-2xl relative" id="poisson-grid">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-emerald-400 text-glow-emerald" />
                <h4 className="text-[11px] font-mono uppercase tracking-widest text-[#94A3B8] text-white font-black">Full 9x9 Poisson Probability Score Matrix</h4>
              </div>
              <p className="text-[10px] text-slate-500 font-sans mb-4 leading-relaxed">
                Refreshed joint probability distribution grid. Bright grid boxes indicate robust likelihood. Solid green outlines key predicted outcome.
              </p>

              <div className="overflow-x-auto select-none border border-white/5 rounded-xl bg-zinc-950">
                <table className="w-full text-center table-fixed border-collapse select-none">
                  <thead>
                    <tr className="border-b border-white/5 bg-zinc-950/85 font-mono text-[9px] text-[#94A3B8] uppercase tracking-widest font-bold">
                      <th className="p-1.5 border-r border-white/5 text-[8px] bg-zinc-950">
                        A \ B
                      </th>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(col => (
                        <th key={col} className="p-1.5 font-bold font-mono text-slate-400 text-xs text-center border-white/5">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(row => (
                      <tr key={row} className="border-b border-white/5 text-[10px]">
                        <td className="p-1.5 font-bold font-mono text-slate-400 bg-zinc-950/45 border-r border-white/5 text-center w-12 text-xs">
                          {row}
                        </td>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(col => {
                          const prob = prediction.scoreMatrix[row]?.[col] || 0;
                          const percent = (prob * 100).toFixed(1);
                          // Coloring
                          const typicalMaxForColor = 0.15;
                          const heatOpacity = Math.min(prob / typicalMaxForColor, 1);
                          const isSimulatedScore = row === prediction.scoreA && col === prediction.scoreB;

                          return (
                            <td 
                              key={col} 
                              className="p-1.5 relative font-mono transition-all group hover:bg-emerald-500/10 cursor-help text-center"
                              style={{ 
                                backgroundColor: isSimulatedScore 
                                  ? 'rgba(16, 185, 129, 0.35)' 
                                  : `rgba(16, 185, 129, ${heatOpacity * 0.18})` 
                              }}
                              title={`Score ${row}-${col} probability: ${percent}%`}
                            >
                              <span className={`block text-[10px] ${isSimulatedScore ? 'text-emerald-350 font-black text-glow-emerald' : 'text-slate-405 font-medium'}`}>
                                {percent}%
                              </span>
                              {isSimulatedScore && (
                                <div className="absolute inset-0 border-2 border-emerald-400 pointer-events-none rounded" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mathematical pmf formula panel */}
              <details className="mt-5 bg-zinc-950/60 rounded-xl border border-white/5 p-4 font-mono select-none group">
                <summary className="text-[11px] uppercase tracking-wider text-slate-300 font-bold cursor-pointer flex items-center justify-between">
                  <span>🔬 View Exact Under-the-hood Poisson & DC Code</span>
                  <span className="text-emerald-400 group-open:rotate-180 transition-all text-xs font-bold text-glow-emerald">▼</span>
                </summary>
                <div className="mt-4 text-xs text-slate-400 space-y-4 text-left leading-relaxed">
                  <p>
                    The Poisson PMF models independent score rates. We apply Dixon-Coles coefficient adjusts (<code className="text-emerald-400 bg-zinc-900 px-1 py-0.5 rounded">&rho; = -0.1</code>) to modify low scorecells (0-0, 1-0, 0-1, 1-1) of the matrix before normalization to unity:
                  </p>
                  <pre className="bg-zinc-950 p-3 rounded text-[11px] text-emerald-400 border border-white/5 overflow-x-auto leading-relaxed">
{`// Dixon-Coles adjustment
if (a === 0 && b === 0) {
  jointProb *= (1 - lambdaA * lambdaB * rho);
} else if (a === 1 && b === 0) {
  jointProb *= (1 + lambdaB * rho);
} else if (a === 0 && b === 1) {
  jointProb *= (1 + lambdaA * rho);
} else if (a === 1 && b === 1) {
  jointProb *= (1 - rho);
}`}
                  </pre>
                </div>
              </details>
            </div>

            {/* Simulated stats indicators & event highlights */}
            <div className="lg:col-span-12 xl:col-span-5 space-y-6">
              
              {/* Event highlights */}
              <div className="bg-carbon-card border border-white/5 p-5 rounded-2xl flex flex-col h-[340px]" id="highlights-feed">
                <h4 className="text-[11px] font-mono uppercase tracking-widest text-[#94A3B8] flex items-center gap-2 mb-4 font-bold">
                  <Timer className="w-4 h-4 text-emerald-405 text-emerald-400" /> Simulated Match Events Feed
                </h4>

                <div className="overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-zinc-800 flex-1">
                  {prediction.timeline.map((evt, idx) => (
                    <div key={idx} className="flex gap-2.5 text-xs border-b border-white/5 pb-2.5 bg-zinc-950/20 p-2.5 rounded hover:bg-zinc-950/40 transition">
                      <span className="font-mono text-emerald-400 text-glow-emerald text-xs font-bold w-10 flex-shrink-0 text-center select-none pt-0.5">
                        {evt.minute}'
                      </span>
                      <p className="text-slate-300 leading-relaxed font-sans">{evt.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats overview */}
              <div className="bg-carbon-card border border-white/5 p-5 rounded-2xl" id="stats-bars">
                <h4 className="text-[11px] font-mono uppercase tracking-widest text-[#94A3B8] flex items-center gap-2 mb-4 font-bold">
                  <Activity className="w-4 h-4 text-emerald-405 text-emerald-400" /> Match Simulator Statistics
                </h4>

                <div className="space-y-4">
                  {/* Possession */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono text-[#94A3B8]">
                      <span className="font-extrabold">{prediction.stats.possessionA}%</span>
                      <span className="text-[9px] text-[#94A3B8] uppercase tracking-widest font-black">Ball Possession</span>
                      <span className="font-extrabold">{prediction.stats.possessionB}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-950 rounded-full flex overflow-hidden border border-white/5">
                      <div className="bg-emerald-500 h-full" style={{ width: `${prediction.stats.possessionA}%` }} />
                      <div className="bg-[#94A3B8] h-full" style={{ width: `${prediction.stats.possessionB}%` }} />
                    </div>
                  </div>

                  {/* Shots */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono text-[#94A3B8]">
                      <span className="font-extrabold">{prediction.stats.shotsA}</span>
                      <span className="text-[9px] text-[#94A3B8] uppercase tracking-widest font-black">Total Shots</span>
                      <span className="font-extrabold">{prediction.stats.shotsB}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-950 rounded-full flex overflow-hidden border border-white/5">
                      <div className="bg-emerald-400 h-full" style={{ width: getComparisonWidths(prediction.stats.shotsA, prediction.stats.shotsB).widthA }} />
                      <div className="bg-[#94A3B8] h-full" style={{ width: getComparisonWidths(prediction.stats.shotsA, prediction.stats.shotsB).widthB }} />
                    </div>
                  </div>

                  {/* On Target */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono text-[#94A3B8]">
                      <span className="font-extrabold">{prediction.stats.shotsOnTargetA}</span>
                      <span className="text-[9px] text-[#94A3B8] uppercase tracking-widest font-black">Shots on Target</span>
                      <span className="font-extrabold">{prediction.stats.shotsOnTargetB}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-950 rounded-full flex overflow-hidden border border-white/5">
                      <div className="bg-emerald-400 h-full" style={{ width: getComparisonWidths(prediction.stats.shotsOnTargetA, prediction.stats.shotsOnTargetB).widthA }} />
                      <div className="bg-[#94A3B8] h-full" style={{ width: getComparisonWidths(prediction.stats.shotsOnTargetA, prediction.stats.shotsOnTargetB).widthB }} />
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* AI commentary editorial text */}
          {prediction.aiAnalysis && (
            <div className="bg-carbon-card border border-white/5 p-6 rounded-2xl space-y-4 stadium-border-glow animate-fade-in" id="ai-editorial">
              <h4 className="text-[11px] font-mono uppercase tracking-widest text-[#94A3B8] flex items-center gap-2 border-b border-white/5 pb-3 font-bold">
                <BookOpen className="w-5 h-5 text-emerald-455 text-emerald-400" /> Match Analyst Report & Tactician Review
              </h4>
              {prediction.aiAnalysis === "Tactical analysis unavailable" ? (
                <div className="flex items-center gap-3 text-slate-500 py-3 bg-zinc-950/40 px-4 rounded-xl border border-white/5">
                  <AlertCircle className="w-5 h-5 text-[#94A3B8] flex-shrink-0" />
                  <span className="text-xs font-mono tracking-tight text-slate-400">Tactical analysis report is currently offline. Deep local statistical simulation models loaded perfectly.</span>
                </div>
              ) : (
                <div className="markdown-body p-1 leading-relaxed text-slate-300 font-sans prose prose-invert max-w-none text-xs sm:text-sm">
                  <Markdown remarkPlugins={[remarkGfm]}>{prediction.aiAnalysis}</Markdown>
                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
