import React, { useState, useEffect } from 'react';
import { Team, Group, TournamentMatch, GroupStanding, MatchPredictionResult } from '../types';
import { simulateMatch, resolveKnockoutTies, TEAM_RATINGS } from '../utils/predictor';
import { Trophy, RefreshCw, ChevronRight, HelpCircle, Eye, Search, Check, AlertCircle } from 'lucide-react';
import TeamFlag from './TeamFlag';

// FIFA 2026 Official Group Draw definitions
export const GROUP_DEFINITIONS: Record<string, string[]> = {
  'A': ['Mexico', 'South Africa', 'South Korea', 'Czechia'],
  'B': ['Canada', 'Bosnia and Herzegovina', 'Qatar', 'Switzerland'],
  'C': ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
  'D': ['United States', 'Paraguay', 'Australia', 'Türkiye'],
  'E': ['Germany', 'Curaçao', "Côte d'Ivoire", 'Ecuador'],
  'F': ['Netherlands', 'Japan', 'Tunisia', 'Sweden'],
  'G': ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  'H': ['Spain', 'Cabo Verde', 'Uruguay', 'Saudi Arabia'],
  'I': ['France', 'Senegal', 'Norway', 'Iraq'],
  'J': ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  'K': ['Portugal', 'Colombia', 'DR Congo', 'Uzbekistan'],
  'L': ['England', 'Croatia', 'Ghana', 'Panama']
};

interface CachedSummary {
  timestamp: string;
  qualifyProbabilities: Record<string, number>;
  championshipProbabilities: Record<string, number>;
  teamChecksum: string;
}

const buildChecksum = (teamsList: Team[]): string => {
  return teamsList.map(t => `${t.code}:${t.name}:${t.overall}:${t.attack}:${t.defense}`).sort().join('|');
};

// Optimized Vanilla JS Web Worker code for the simulations (no-GUI, ultra-fast mathematics)
const workerCode = `
self.onmessage = function(e) {
  const { teams, teamRatings, groupDef, numRuns } = e.data;

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const AVG_GOALS = 1.35;

  function factorial(n) {
    if (n <= 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  function poissonPMF(k, lambda) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
  }

  function simulateScore(teamA, teamB) {
    const ratingsA = teamRatings[teamA.name] || { attack: 1.0, defense: 1.0 };
    const ratingsB = teamRatings[teamB.name] || { attack: 1.0, defense: 1.0 };

    const lambdaA = ratingsA.attack * ratingsB.defense * AVG_GOALS;
    const lambdaB = ratingsB.attack * ratingsA.defense * AVG_GOALS;

    const scoreMatrix = [];
    let totalSum = 0;
    for (let a = 0; a <= 8; a++) {
      scoreMatrix[a] = [];
      for (let b = 0; b <= 8; b++) {
        const pA = poissonPMF(a, lambdaA);
        const pB = poissonPMF(b, lambdaB);
        let jointProb = pA * pB;

        const rho = -0.1;
        let correction = 1.0;
        if (a === 0 && b === 0) {
          correction = 1 - (lambdaA * lambdaB * rho);
        } else if (a === 1 && b === 0) {
          correction = 1 + (lambdaB * rho);
        } else if (a === 0 && b === 1) {
          correction = 1 + (lambdaA * rho);
        } else if (a === 1 && b === 1) {
          correction = 1 - rho;
        }
        jointProb *= correction;
        const cell = Math.max(0, jointProb);
        scoreMatrix[a][b] = cell;
        totalSum += cell;
      }
    }

    if (totalSum > 0) {
      for (let a = 0; a <= 8; a++) {
        for (let b = 0; b <= 8; b++) {
          scoreMatrix[a][b] /= totalSum;
        }
      }
    }

    const randVal = Math.random();
    let cumulative = 0;
    for (let a = 0; a <= 8; a++) {
      for (let b = 0; b <= 8; b++) {
        cumulative += scoreMatrix[a][b];
        if (randVal <= cumulative) {
          return { scoreA: a, scoreB: b, lambdaA, lambdaB };
        }
      }
    }
    return { scoreA: 0, scoreB: 0, lambdaA, lambdaB };
  }

  function resolveKnockout(teamA, teamB, result) {
    if (result.scoreA !== result.scoreB) {
      return result.scoreA > result.scoreB ? teamA : teamB;
    }

    const extLambdaA = result.lambdaA * 0.33;
    const extLambdaB = result.lambdaB * 0.33;

    function sampleExtGoals(lambda) {
      const probs = [];
      let sum = 0;
      for (let k = 0; k <= 3; k++) {
        const p = poissonPMF(k, lambda);
        probs.push(p);
        sum += p;
      }
      const r = Math.random() * sum;
      let cum = 0;
      for (let k = 0; k <= 3; k++) {
        cum += probs[k];
        if (r <= cum) return k;
      }
      return 0;
    }

    let extraGoalsA = sampleExtGoals(extLambdaA);
    let extraGoalsB = sampleExtGoals(extLambdaB);

    if (Math.random() > 0.8 && extraGoalsA === 0 && extraGoalsB === 0) {
      if (Math.random() > 0.5) extraGoalsA = 1;
      else extraGoalsB = 1;
    }

    const extScoreA = result.scoreA + extraGoalsA;
    const extScoreB = result.scoreB + extraGoalsB;

    if (extScoreA !== extScoreB) {
      return extScoreA > extScoreB ? teamA : teamB;
    }

    const penRateA = 0.75 + (teamA.gk - 75) * 0.002;
    const penRateB = 0.75 + (teamB.gk - 75) * 0.002;

    let penScoreA = 0;
    let penScoreB = 0;
    let kicks = 0;

    while (true) {
      kicks++;
      if (Math.random() < penRateA) penScoreA++;

      if (kicks >= 3) {
        if (penScoreA > penScoreB + (5 - kicks + 1)) break;
        if (penScoreB > penScoreA + (5 - kicks)) break;
      }

      if (Math.random() < penRateB) penScoreB++;

      if (kicks >= 3) {
        if (penScoreA > penScoreB + (5 - kicks)) break;
        if (penScoreB > penScoreA + (5 - kicks)) break;
      }

      if (kicks >= 5 && penScoreA !== penScoreB) {
        break;
      }

      if (kicks > 12) {
        if (Math.random() > 0.5) penScoreA++;
        else penScoreB++;
        break;
      }
    }

    return penScoreA > penScoreB ? teamA : teamB;
  }

  const qualifyCount = {};
  const championCount = {};

  teams.forEach(t => {
    qualifyCount[t.code] = 0;
    championCount[t.code] = 0;
  });

  const teamMap = {};
  teams.forEach(t => {
    teamMap[t.code] = t;
    teamMap[t.name] = t;
  });

  for (let run = 1; run <= numRuns; run++) {
    const groupStandings = {};

    letters.forEach(letter => {
      const groupTeamNames = groupDef[letter];
      const grpTeams = groupTeamNames.map(name => teamMap[name]);

      const standings = grpTeams.map(t => ({
        team: t,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
      }));

      const fixtures = [
        [0, 1], [2, 3], [0, 2], [1, 3], [3, 0], [1, 2]
      ];

      fixtures.forEach(([idxA, idxB]) => {
        const tA = grpTeams[idxA];
        const tB = grpTeams[idxB];
        const res = simulateScore(tA, tB);

        const sA = standings.find(s => s.team.code === tA.code);
        const sB = standings.find(s => s.team.code === tB.code);

        sA.played++;
        sB.played++;
        sA.goalsFor += res.scoreA;
        sA.goalsAgainst += res.scoreB;
        sA.goalDifference = sA.goalsFor - sA.goalsAgainst;

        sB.goalsFor += res.scoreB;
        sB.goalsAgainst += res.scoreA;
        sB.goalDifference = sB.goalsFor - sB.goalsAgainst;

        if (res.scoreA > res.scoreB) {
          sA.won++;
          sA.points += 3;
          sB.lost++;
        } else if (res.scoreB > res.scoreA) {
          sB.won++;
          sB.points += 3;
          sA.lost++;
        } else {
          sA.drawn++;
          sA.points += 1;
          sB.drawn++;
          sB.points += 1;
        }
      });

      standings.sort((x, y) => {
        if (y.points !== x.points) return y.points - x.points;
        if (y.goalDifference !== x.goalDifference) return y.goalDifference - x.goalDifference;
        if (y.goalsFor !== x.goalsFor) return y.goalsFor - x.goalsFor;
        return x.team.code.localeCompare(y.team.code);
      });

      groupStandings[letter] = standings;

      qualifyCount[standings[0].team.code]++;
      qualifyCount[standings[1].team.code]++;
    });

    const winners = [];
    const runners = [];

    letters.forEach(letter => {
      const st = groupStandings[letter];
      winners.push({ team: st[0].team, points: st[0].points, goalDifference: st[0].goalDifference, goalsFor: st[0].goalsFor });
      runners.push({ team: st[1].team, points: st[1].points, goalDifference: st[1].goalDifference, goalsFor: st[1].goalsFor });
    });

    const sortCamp = (a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.team.code.localeCompare(b.team.code);
    };

    const sortedWinners = [...winners].sort(sortCamp);
    const sortedRunners = [...runners].sort(sortCamp);

    const qualifiedWinners = sortedWinners.map(w => w.team);
    const qualifiedRunners = sortedRunners.slice(0, 4).map(r => r.team);

    const allQualified = [...qualifiedWinners, ...qualifiedRunners];

    const r16Winners = [];
    for (let i = 0; i < 8; i++) {
       const teamA = allQualified[i];
       const teamB = allQualified[15 - i];
       const res = simulateScore(teamA, teamB);
       const winner = resolveKnockout(teamA, teamB, res);
       r16Winners.push(winner);
    }

    const qfWinners = [];
    for (let i = 0; i < 4; i++) {
       const teamA = r16Winners[i * 2];
       const teamB = r16Winners[i * 2 + 1];
       const res = simulateScore(teamA, teamB);
       const winner = resolveKnockout(teamA, teamB, res);
       qfWinners.push(winner);
    }

    const sfWinners = [];
    for (let i = 0; i < 2; i++) {
       const teamA = qfWinners[i * 2];
       const teamB = qfWinners[i * 2 + 1];
       const res = simulateScore(teamA, teamB);
       const winner = resolveKnockout(teamA, teamB, res);
       sfWinners.push(winner);
    }

    const resFinal = simulateScore(sfWinners[0], sfWinners[1]);
    const champion = resolveKnockout(sfWinners[0], sfWinners[1], resFinal);

    championCount[champion.code]++;

    if (run % 500 === 0 || run === numRuns) {
      self.postMessage({ type: 'progress', progress: Math.round((run / numRuns) * 100) });
    }
  }

  self.postMessage({
    type: 'complete',
    qualifyCount,
    championCount,
    numRuns
  });
};
`;

export default function TournamentSimulator({ teams }: { teams: Team[] }) {
  // Simulator Model State
  const [simulatorMode, setSimulatorMode] = useState<'aggregate' | 'single'>('aggregate');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Loaded cache state
  const [cachedSummary, setCachedSummary] = useState<CachedSummary | null>(() => {
    try {
      const item = localStorage.getItem('tournament_simulation_summary');
      if (item) {
        const parsed = JSON.parse(item) as CachedSummary;
        const currentChecksum = buildChecksum(teams);
        if (parsed.teamChecksum === currentChecksum) {
          return parsed;
        }
      }
    } catch {
      // Ignored
    }
    return null;
  });

  // Single Playground Run Stage Navigation Tabs
  const [activeStage, setActiveStage] = useState<'groups' | 'knockouts'>('groups');

  // Master Lists for Sandbox Single Run
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsSimulated, setGroupsSimulated] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Bracket fixtures
  const [r16, setR16] = useState<TournamentMatch[]>([]);
  const [quarters, setQuarters] = useState<TournamentMatch[]>([]);
  const [semis, setSemis] = useState<TournamentMatch[]>([]);
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState<TournamentMatch | null>(null);
  const [finalMatch, setFinalMatch] = useState<TournamentMatch | null>(null);
  const [champion, setChampion] = useState<Team | null>(null);

  // Inspector Dialog Modal Match Detail State
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);

  // Synchronous mount-on trigger
  useEffect(() => {
    initializeTournament();
  }, [teams]);

  useEffect(() => {
    if (!cachedSummary && teams && teams.length > 0) {
      handleRun10kSimulations();
    }
  }, [teams]);

  // Checksum sync if ratings/groups configuration list alters on-tab
  useEffect(() => {
    if (cachedSummary) {
      const currentChecksum = buildChecksum(teams);
      if (cachedSummary.teamChecksum !== currentChecksum) {
        setCachedSummary(null);
      }
    }
  }, [teams]);

  const initializeTournament = () => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    try {
      const placedNamesSet = new Set<string>();
      const placedNamesList: string[] = [];

      for (const letter of letters) {
        const teamNames = GROUP_DEFINITIONS[letter];
        if (!teamNames || teamNames.length !== 4) {
          throw new Error(`Group ${letter} must contain precisely 4 teams.`);
        }
        for (const name of teamNames) {
          if (placedNamesSet.has(name)) {
            throw new Error(`Duplicate team placed: '${name}' exists in multiple groups.`);
          }
          placedNamesSet.add(name);
          placedNamesList.push(name);
        }
      }

      if (placedNamesSet.size !== 48 || teams.length !== 48) {
        throw new Error(`Expected exactly 48 teams but found ${teams.length}.`);
      }

      teams.forEach(t => {
        if (!placedNamesSet.has(t.name)) {
          throw new Error(`Roster team '${t.name}' is missing from official group configs.`);
        }
      });

      setValidationError(null);
    } catch (err: any) {
      setValidationError(err.message || 'Roster validation failed');
      return;
    }

    const generatedGroups: Group[] = letters.map(letter => {
      const groupTeamNames = GROUP_DEFINITIONS[letter];
      const groupTeams = groupTeamNames.map(name => teams.find(t => t.name === name)!);

      const standings: GroupStanding[] = groupTeams.map(t => ({
        teamCode: t.code,
        played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
      }));

      const fixtures: TournamentMatch[] = [
        { id: `G-${letter}-1`, stage: 'group', groupName: letter, teamA: groupTeams[0], teamB: groupTeams[1], played: false },
        { id: `G-${letter}-2`, stage: 'group', groupName: letter, teamA: groupTeams[2], teamB: groupTeams[3], played: false },
        { id: `G-${letter}-3`, stage: 'group', groupName: letter, teamA: groupTeams[0], teamB: groupTeams[2], played: false },
        { id: `G-${letter}-4`, stage: 'group', groupName: letter, teamA: groupTeams[1], teamB: groupTeams[3], played: false },
        { id: `G-${letter}-5`, stage: 'group', groupName: letter, teamA: groupTeams[3], teamB: groupTeams[0], played: false },
        { id: `G-${letter}-6`, stage: 'group', groupName: letter, teamA: groupTeams[1], teamB: groupTeams[2], played: false }
      ];

      return { name: letter, teams: groupTeams, standings, matches: fixtures };
    });

    setGroups(generatedGroups);
    setGroupsSimulated(false);
    setR16([]);
    setQuarters([]);
    setSemis([]);
    setThirdPlaceMatch(null);
    setFinalMatch(null);
    setChampion(null);
  };

  // Run 10,000 simulations using Web Worker + robust main thread timeout fallback
  const handleRun10kSimulations = () => {
    setIsSimulating(true);
    setSimProgress(0);

    try {
      const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(workerBlob);
      const worker = new Worker(workerUrl);

      worker.postMessage({
        teams,
        teamRatings: TEAM_RATINGS,
        groupDef: GROUP_DEFINITIONS,
        numRuns: 10000
      });

      worker.onmessage = (e) => {
        const { type, progress, qualifyCount, championCount } = e.data;
        if (type === 'progress') {
          setSimProgress(progress);
        } else if (type === 'complete') {
          const timestamp = new Date().toLocaleString();
          const checksum = buildChecksum(teams);

          const qualifyProb: Record<string, number> = {};
          const champProb: Record<string, number> = {};

          teams.forEach(t => {
            qualifyProb[t.code] = parseFloat(((qualifyCount[t.code] || 0) / 10000 * 100).toFixed(2));
            champProb[t.code] = parseFloat(((championCount[t.code] || 0) / 10000 * 100).toFixed(2));
          });

          const newSummary = {
            timestamp,
            qualifyProbabilities: qualifyProb,
            championshipProbabilities: champProb,
            teamChecksum: checksum
          };

          setCachedSummary(newSummary);
          localStorage.setItem('tournament_simulation_summary', JSON.stringify(newSummary));

          setIsSimulating(false);
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
        }
      };

      worker.onerror = (err) => {
        console.warn("Web Worker error, falling back to chunked main thread execution:", err);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        runMainThreadSimulation();
      };
    } catch (err) {
      console.warn("Failed web worker instancing, running chunked main thread fallback:", err);
      runMainThreadSimulation();
    }
  };

  const runMainThreadSimulation = () => {
    let currentRun = 0;
    const totalRuns = 10000;
    const qualifyCount: Record<string, number> = {};
    const championCount: Record<string, number> = {};
    teams.forEach(t => {
      qualifyCount[t.code] = 0;
      championCount[t.code] = 0;
    });

    const runBatch = () => {
      const batchSize = 1000;
      const end = Math.min(totalRuns, currentRun + batchSize);
      for (let run = currentRun + 1; run <= end; run++) {
        const result = runSingleFullSimulation();
        result.qualifiedCodes.forEach(code => {
          qualifyCount[code] = (qualifyCount[code] || 0) + 1;
        });
        championCount[result.championCode] = (championCount[result.championCode] || 0) + 1;
      }
      currentRun = end;
      setSimProgress(Math.round((currentRun / totalRuns) * 100));

      if (currentRun < totalRuns) {
        setTimeout(runBatch, 0);
      } else {
        const timestamp = new Date().toLocaleString();
        const checksum = buildChecksum(teams);

        const qualifyProb: Record<string, number> = {};
        const champProb: Record<string, number> = {};

        teams.forEach(t => {
          qualifyProb[t.code] = parseFloat(((qualifyCount[t.code] || 0) / 10000 * 100).toFixed(2));
          champProb[t.code] = parseFloat(((championCount[t.code] || 0) / 10000 * 100).toFixed(2));
        });

        const newSummary = {
          timestamp,
          qualifyProbabilities: qualifyProb,
          championshipProbabilities: champProb,
          teamChecksum: checksum
        };

        setCachedSummary(newSummary);
        localStorage.setItem('tournament_simulation_summary', JSON.stringify(newSummary));
        setIsSimulating(false);
      }
    };

    runBatch();
  };

  const runSingleFullSimulation = () => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const groupCampaigns: Record<string, { team: Team; points: number; goalDifference: number; goalsFor: number }[]> = {};

    letters.forEach(letter => {
      const teamNames = GROUP_DEFINITIONS[letter];
      const grpTeams = teamNames.map(name => teams.find(t => t.name === name)!);
      const standings = grpTeams.map(t => ({
        team: t, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
      }));

      const fixtures = [[0, 1], [2, 3], [0, 2], [1, 3], [3, 0], [1, 2]];
      fixtures.forEach(([idxA, idxB]) => {
        const tA = grpTeams[idxA];
        const tB = grpTeams[idxB];
        const res = simulateMatch({
          teamA: tA.code, teamB: tB.code, tacticsA: 'Standard', tacticsB: 'Standard',
          formWeight: 0.5, injurySeverityA: 0, injurySeverityB: 0, neutralGround: true
        });

        const sA = standings.find(s => s.team.code === tA.code)!;
        const sB = standings.find(s => s.team.code === tB.code)!;

        sA.played++; sB.played++;
        sA.goalsFor += res.scoreA; sA.goalsAgainst += res.scoreB;
        sA.goalDifference = sA.goalsFor - sA.goalsAgainst;
        sB.goalsFor += res.scoreB; sB.goalsAgainst += res.scoreA;
        sB.goalDifference = sB.goalsFor - sB.goalsAgainst;

        if (res.scoreA > res.scoreB) { sA.won++; sA.points += 3; sB.lost++; }
        else if (res.scoreB > res.scoreA) { sB.won++; sB.points += 3; sA.lost++; }
        else { sA.drawn++; sA.points += 1; sB.drawn++; sB.points += 1; }
      });

      standings.sort((x, y) => {
        if (y.points !== x.points) return y.points - x.points;
        if (y.goalDifference !== x.goalDifference) return y.goalDifference - x.goalDifference;
        if (y.goalsFor !== x.goalsFor) return y.goalsFor - x.goalsFor;
        return x.team.code.localeCompare(y.team.code);
      });

      groupCampaigns[letter] = standings;
    });

    const winnersList: any[] = [];
    const runnersList: any[] = [];

    letters.forEach(letter => {
      const grp = groupCampaigns[letter];
      winnersList.push(grp[0]);
      runnersList.push(grp[1]);
    });

    const sortCampaign = (a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.team.code.localeCompare(b.team.code);
    };

    const sortedWinners = [...winnersList].sort(sortCampaign);
    const sortedRunners = [...runnersList].sort(sortCampaign);

    const qualifiedWinners = sortedWinners.map(w => w.team);
    const qualifiedRunners = sortedRunners.slice(0, 4).map(r => r.team);
    const allQualified = [...qualifiedWinners, ...qualifiedRunners];

    const r16Winners: Team[] = [];
    for (let i = 0; i < 8; i++) {
      const teamA = allQualified[i];
      const teamB = allQualified[15 - i];
      let res = simulateMatch({
        teamA: teamA.code, teamB: teamB.code, tacticsA: 'Standard', tacticsB: 'Standard',
        formWeight: 0.5, injurySeverityA: 0, injurySeverityB: 0, neutralGround: true
      });
      res = resolveKnockoutTies(res);
      const winner = res.scoreA > res.scoreB ? teamA : res.scoreB > res.scoreA ? teamB : res.penaltiesWinner === teamA.code ? teamA : teamB;
      r16Winners.push(winner);
    }

    const qfWinners: Team[] = [];
    for (let i = 0; i < 4; i++) {
      const teamA = r16Winners[i * 2];
      const teamB = r16Winners[i * 2 + 1];
      let res = simulateMatch({
        teamA: teamA.code, teamB: teamB.code, tacticsA: 'Standard', tacticsB: 'Standard',
        formWeight: 0.5, injurySeverityA: 0, injurySeverityB: 0, neutralGround: true
      });
      res = resolveKnockoutTies(res);
      const winner = res.scoreA > res.scoreB ? teamA : res.scoreB > res.scoreA ? teamB : res.penaltiesWinner === teamA.code ? teamA : teamB;
      qfWinners.push(winner);
    }

    const sfWinners: Team[] = [];
    for (let i = 0; i < 2; i++) {
      const teamA = qfWinners[i * 2];
      const teamB = qfWinners[i * 2 + 1];
      let res = simulateMatch({
        teamA: teamA.code, teamB: teamB.code, tacticsA: 'Standard', tacticsB: 'Standard',
        formWeight: 0.5, injurySeverityA: 0, injurySeverityB: 0, neutralGround: true
      });
      res = resolveKnockoutTies(res);
      const winner = res.scoreA > res.scoreB ? teamA : res.scoreB > res.scoreA ? teamB : res.penaltiesWinner === teamA.code ? teamA : teamB;
      sfWinners.push(winner);
    }

    let resFinal = simulateMatch({
      teamA: sfWinners[0].code, teamB: sfWinners[1].code, tacticsA: 'Standard', tacticsB: 'Standard',
      formWeight: 0.5, injurySeverityA: 0, injurySeverityB: 0, neutralGround: true
    });
    resFinal = resolveKnockoutTies(resFinal);
    const champ = resFinal.scoreA > resFinal.scoreB ? sfWinners[0] : resFinal.scoreB > resFinal.scoreA ? sfWinners[1] : resFinal.penaltiesWinner === sfWinners[0].code ? sfWinners[0] : sfWinners[1];

    return {
      qualifiedCodes: allQualified.map(t => t.code),
      championCode: champ.code
    };
  };

  // Play Single Bracket Match handlers
  const handleSimulateGroups = () => {
    const nextGroups = [...groups];

    nextGroups.forEach(group => {
      group.standings = group.teams.map(t => ({
        teamCode: t.code, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
      }));

      group.matches.forEach(match => {
        const result = simulateMatch({
          teamA: match.teamA!.code, teamB: match.teamB!.code, tacticsA: 'Standard', tacticsB: 'Standard',
          formWeight: 0.5, injurySeverityA: 0, injurySeverityB: 0, neutralGround: true
        });

        match.played = true;
        match.scoreA = result.scoreA;
        match.scoreB = result.scoreB;
        match.prediction = result;

        const sA = group.standings.find(s => s.teamCode === match.teamA!.code)!;
        const sB = group.standings.find(s => s.teamCode === match.teamB!.code)!;

        sA.played += 1; sB.played += 1;
        sA.goalsFor += result.scoreA; sA.goalsAgainst += result.scoreB;
        sA.goalDifference = sA.goalsFor - sA.goalsAgainst;
        sB.goalsFor += result.scoreB; sB.goalsAgainst += result.scoreA;
        sB.goalDifference = sB.goalsFor - sB.goalsAgainst;

        if (result.scoreA > result.scoreB) { sA.won += 1; sA.points += 3; sB.lost += 1; }
        else if (result.scoreB > result.scoreA) { sB.won += 1; sB.points += 3; sA.lost += 1; }
        else { sA.drawn += 1; sA.points += 1; sB.drawn += 1; sB.points += 1; }
      });

      group.standings.sort((x, y) => {
        if (y.points !== x.points) return y.points - x.points;
        if (y.goalDifference !== x.goalDifference) return y.goalDifference - x.goalDifference;
        if (y.goalsFor !== x.goalsFor) return y.goalsFor - x.goalsFor;
        return x.teamCode.localeCompare(y.teamCode);
      });
    });

    setGroups(nextGroups);
    setGroupsSimulated(true);
    populateRoundOf16(nextGroups);
  };

  const populateRoundOf16 = (filledGroups: Group[]) => {
    const winners: { team: Team; standing: GroupStanding }[] = [];
    const runners: { team: Team; standing: GroupStanding }[] = [];

    filledGroups.forEach(grp => {
      const wTeam = teams.find(t => t.code === grp.standings[0].teamCode)!;
      const rTeam = teams.find(t => t.code === grp.standings[1].teamCode)!;
      winners.push({ team: wTeam, standing: grp.standings[0] });
      runners.push({ team: rTeam, standing: grp.standings[1] });
    });

    const sortStandingFunc = (a: any, b: any) => {
      if (b.standing.points !== a.standing.points) return b.standing.points - a.standing.points;
      if (b.standing.goalDifference !== a.standing.goalDifference) return b.standing.goalDifference - a.standing.goalDifference;
      if (b.standing.goalsFor !== a.standing.goalsFor) return b.standing.goalsFor - a.standing.goalsFor;
      return a.team.code.localeCompare(b.team.code);
    };

    const sortedWinners = [...winners].sort(sortStandingFunc);
    const sortedRunners = [...runners].sort(sortStandingFunc);

    const qualifiedWinners = sortedWinners.map(w => w.team);
    const qualifiedRunners = sortedRunners.slice(0, 4).map(r => r.team);
    const allQualified = [...qualifiedWinners, ...qualifiedRunners];

    const fixtures: TournamentMatch[] = [];
    for (let i = 0; i < 8; i++) {
      fixtures.push({
        id: `KO-R16-${i + 1}`, stage: 'r16', teamA: allQualified[i], teamB: allQualified[15 - i], played: false,
        placeholderA: `Seed ${i + 1}`, placeholderB: `Seed ${16 - i}`
      });
    }

    setR16(fixtures);
    setQuarters([]); setSemis([]); setThirdPlaceMatch(null); setFinalMatch(null); setChampion(null);
  };

  const simulateKnockoutRound = (currentMatches: TournamentMatch[], nextStageName: 'quarter' | 'semi' | 'final', updateState: (m: TournamentMatch[]) => void) => {
    const playedMatches = currentMatches.map(match => {
      let result = simulateMatch({
        teamA: match.teamA!.code, teamB: match.teamB!.code, tacticsA: 'Standard', tacticsB: 'Standard',
        formWeight: 0.5, injurySeverityA: 0, injurySeverityB: 0, neutralGround: true
      });
      result = resolveKnockoutTies(result);

      return {
        ...match, played: true, scoreA: result.scoreA, scoreB: result.scoreB,
        penaltiesWinner: result.penaltiesWinner, scoreA_Pen: result.scoreA_Penalties, scoreB_Pen: result.scoreB_Penalties, prediction: result
      };
    });

    updateState(playedMatches);

    const getWinner = (m: TournamentMatch) => {
      if (m.scoreA! > m.scoreB!) return m.teamA!;
      if (m.scoreB! > m.scoreA!) return m.teamB!;
      return m.penaltiesWinner === m.teamA!.code ? m.teamA! : m.teamB!;
    };

    if (nextStageName === 'quarter') {
      const qFixtures: TournamentMatch[] = [
        { id: 'KO-QF-1', stage: 'quarter', teamA: getWinner(playedMatches[0]), teamB: getWinner(playedMatches[1]), played: false },
        { id: 'KO-QF-2', stage: 'quarter', teamA: getWinner(playedMatches[2]), teamB: getWinner(playedMatches[3]), played: false },
        { id: 'KO-QF-3', stage: 'quarter', teamA: getWinner(playedMatches[4]), teamB: getWinner(playedMatches[5]), played: false },
        { id: 'KO-QF-4', stage: 'quarter', teamA: getWinner(playedMatches[6]), teamB: getWinner(playedMatches[7]), played: false }
      ];
      setQuarters(qFixtures);
    } else if (nextStageName === 'semi') {
      const sFixtures: TournamentMatch[] = [
        { id: 'KO-SF-1', stage: 'semi', teamA: getWinner(playedMatches[0]), teamB: getWinner(playedMatches[1]), played: false },
        { id: 'KO-SF-2', stage: 'semi', teamA: getWinner(playedMatches[2]), teamB: getWinner(playedMatches[3]), played: false }
      ];
      setSemis(sFixtures);
    }
  };

  const handleSimulateSemis = () => {
    const nextSemis = semis.map(match => {
      let result = simulateMatch({
        teamA: match.teamA!.code, teamB: match.teamB!.code, tacticsA: 'Standard', tacticsB: 'Standard',
        formWeight: 0.5, injurySeverityA: 0, injurySeverityB: 0, neutralGround: true
      });
      result = resolveKnockoutTies(result);

      return {
        ...match, played: true, scoreA: result.scoreA, scoreB: result.scoreB,
        penaltiesWinner: result.penaltiesWinner, scoreA_Pen: result.scoreA_Penalties, scoreB_Pen: result.scoreB_Penalties, prediction: result
      };
    });

    setSemis(nextSemis);

    const getWinner = (m: TournamentMatch) => {
      if (m.scoreA! > m.scoreB!) return m.teamA!;
      if (m.scoreB! > m.scoreA!) return m.teamB!;
      return m.penaltiesWinner === m.teamA!.code ? m.teamA! : m.teamB!;
    };
    const getLoser = (m: TournamentMatch) => {
      const w = getWinner(m);
      return w.code === m.teamA!.code ? m.teamB! : m.teamA!;
    };

    const fMatch: TournamentMatch = { id: 'KO-FI', stage: 'final', teamA: getWinner(nextSemis[0]), teamB: getWinner(nextSemis[1]), played: false };
    const tMatch: TournamentMatch = { id: 'KO-3P', stage: 'third', teamA: getLoser(nextSemis[0]), teamB: getLoser(nextSemis[1]), played: false };

    setFinalMatch(fMatch);
    setThirdPlaceMatch(tMatch);
    setChampion(null);
  };

  const handleSimulateFinal = () => {
    if (!finalMatch || !thirdPlaceMatch) return;

    let result3 = simulateMatch({
      teamA: thirdPlaceMatch.teamA!.code, teamB: thirdPlaceMatch.teamB!.code, tacticsA: 'Standard', tacticsB: 'Standard',
      formWeight: 0.5, injurySeverityA: 0, injurySeverityB: 0, neutralGround: true
    });
    result3 = resolveKnockoutTies(result3);

    const next3P = {
      ...thirdPlaceMatch, played: true, scoreA: result3.scoreA, scoreB: result3.scoreB,
      penaltiesWinner: result3.penaltiesWinner, scoreA_Pen: result3.scoreA_Penalties, scoreB_Pen: result3.scoreB_Penalties, prediction: result3
    };

    let resultF = simulateMatch({
      teamA: finalMatch.teamA!.code, teamB: finalMatch.teamB!.code, tacticsA: 'Standard', tacticsB: 'Standard',
      formWeight: 0.5, injurySeverityA: 0, injurySeverityB: 0, neutralGround: true
    });
    resultF = resolveKnockoutTies(resultF);

    const nextFinal = {
      ...finalMatch, played: true, scoreA: resultF.scoreA, scoreB: resultF.scoreB,
      penaltiesWinner: resultF.penaltiesWinner, scoreA_Pen: resultF.scoreA_Penalties, scoreB_Pen: resultF.scoreB_Penalties, prediction: resultF
    };

    const finalChamp = resultF.scoreA > resultF.scoreB 
      ? finalMatch.teamA! 
      : resultF.scoreB > resultF.scoreA 
        ? finalMatch.teamB! 
        : resultF.penaltiesWinner === finalMatch.teamA!.code ? finalMatch.teamA! : finalMatch.teamB!;

    setFinalMatch(nextFinal);
    setThirdPlaceMatch(next3P);
    setChampion(finalChamp);
  };

  if (validationError) {
    return (
      <div className="min-h-[400px] bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-mono p-6 border border-red-500/30 rounded-2xl">
        <div className="bg-red-950/40 border border-red-900/50 p-8 rounded-2xl text-center space-y-4 max-w-xl shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
            <span className="text-red-400 text-3xl font-bold">!</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-red-500">Official Roster Validation Failed</h1>
            <p className="text-xs text-slate-400 mt-1">The tournament simulator enforces exact alignment with safety constraints.</p>
          </div>
          <div className="bg-slate-950 p-4 rounded-lg text-xs border border-slate-850 text-red-400 text-left overflow-auto max-h-40 whitespace-pre-wrap font-mono">
            Error: {validationError}
          </div>
        </div>
      </div>
    );
  }

  // Pre-calculate search filtered data for aggregate champion list
  const sortedTeamsForChamp = [...teams].map(t => ({
    team: t,
    prob: cachedSummary?.championshipProbabilities[t.code] || 0,
    advanceProb: cachedSummary?.qualifyProbabilities[t.code] || 0
  })).sort((x, y) => y.prob - x.prob);

  const top1 = sortedTeamsForChamp[0];

  const filteredChampionshipList = sortedTeamsForChamp.filter(item => 
    item.team.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.team.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="tournament-simulator-workspace-root">

      {/* Selector tab header option */}
      <div className="bg-slate-900 border border-slate-850/80 p-4 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center">
            <Trophy className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-sans font-extrabold text-slate-100 text-base">FIFA World Cup Simulator</h3>
            <p className="text-[10px] font-mono text-slate-400 mt-0.5">Explore full campaign dynamics mathematically or play a sandbox single bracket.</p>
          </div>
        </div>

        {/* MODE CONTROLLER TOGGLE */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850 w-full lg:w-auto justify-center">
          <button
            id="toggle-aggregate-mode"
            onClick={() => setSimulatorMode('aggregate')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
              simulatorMode === 'aggregate' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📊 10,000-Run Probabilities
          </button>
          <button
            id="toggle-single-mode"
            onClick={() => setSimulatorMode('single')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
              simulatorMode === 'single' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🎮 Sandbox Bracket
          </button>
        </div>
      </div>

      {/* OPTION A: AGGREGATE 10,000 RUN AUTOMATIC STATS VIEW */}
      {simulatorMode === 'aggregate' && (
        <div className="space-y-6 animate-fade-in" id="aggregate-simulation-view-container">
          
          {/* Plain-Language Disclaimer info-alert box */}
          <div className="bg-[#0b1322] border border-blue-900/35 p-4 rounded-xl flex items-start gap-4 shadow-xl" id="probability-disclaimer-box">
            <HelpCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-slate-300">
              <span className="font-semibold text-slate-200 uppercase tracking-wider block text-[10px] font-mono">Statistical Probability Advisory</span>
              <p className="leading-relaxed">
                This simulator plays the complete World Cup tournament **10,000 times** in the background. It displays the statistical 
                likelihood (**probabilities**) of each team advancing or winning, rather than single scores or fixed certainties. 
              </p>
              <p className="text-slate-400 leading-relaxed">
                Instead of showing a single match score or table, we aggregate who finishes in the **Top 2** of their group and wins the champion trophy across 
                all runs. This isolates a nation's robust performance index based on ratings strength and seed positions.
              </p>
            </div>
          </div>

          {/* Aggregate Action and snapshot indicators */}
          <div className="bg-slate-900 border border-slate-850 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="font-sans font-bold text-slate-200 text-sm">Aggregate Campaign Dashboard</h4>
              <p className="text-xs text-slate-400 font-mono">
                {cachedSummary ? `Last comprehensive snapshot processed: ${cachedSummary.timestamp}` : 'Ready to compile Poisson estimations...'}
              </p>
            </div>

            <button
              id="run-bulk-aggregate-sim-btn"
              onClick={handleRun10kSimulations}
              disabled={isSimulating}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold uppercase text-xs rounded-lg flex items-center justify-center gap-2 cursor-pointer transition shadow-md disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
              {isSimulating ? 'Simulating...' : cachedSummary ? 'Re-Run 10,000 matches' : 'Run 10,000 Simulations'}
            </button>
          </div>

          {/* Progress bar state indicator */}
          {isSimulating && (
            <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-2 animate-pulse">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-emerald-400 font-bold">Simulating 10,000 complete World Cup runs...</span>
                <span>{simProgress}% completed</span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-100" style={{ width: `${simProgress}%` }} />
              </div>
            </div>
          )}

          {/* Aggregate 12 Groups Chances display list */}
          {cachedSummary ? (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-2">
                <h5 className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Group Stages: Probability to Advance (Top 2 Group Finish)</h5>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {Object.keys(GROUP_DEFINITIONS).map(letter => {
                  const grpTeams = GROUP_DEFINITIONS[letter].map(name => teams.find(t => t.name === name)!);
                  const sortedGrp = grpTeams.map(t => ({
                    team: t,
                    prob: cachedSummary.qualifyProbabilities[t.code] || 0
                  })).sort((x, y) => y.prob - x.prob);

                  return (
                    <div key={letter} className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-1 w-full">
                        <span className="font-mono text-slate-300 font-bold text-xs">Group {letter}</span>
                        <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-wider font-bold">Top 2 Highlighted</span>
                      </div>

                      <div className="space-y-2.5">
                        {sortedGrp.map((item, idx) => {
                          const isTop2 = idx <= 1;
                          return (
                            <div key={item.team.code} className="relative p-2 rounded-lg bg-slate-950/40 border border-slate-850/50 overflow-hidden flex flex-col justify-center">
                              {/* Background Bar */}
                              <div 
                                className={`absolute inset-y-0 left-0 opacity-10 transition-all ${isTop2 ? 'bg-emerald-500' : 'bg-slate-600'}`} 
                                style={{ width: `${item.prob}%` }}
                              />
                              
                              <div className="flex items-center justify-between z-10 relative text-xs font-mono">
                                <div className="flex items-center gap-1.5 truncate">
                                  <TeamFlag name={item.team.name} height={10} className="rounded-xs border border-white/5 flex-shrink-0" />
                                  <span className={`font-semibold truncate max-w-[90px] ${isTop2 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    {item.team.name}
                                  </span>
                                  {isTop2 && <span className="text-[8px] text-emerald-400/90 font-bold bg-emerald-500/10 border border-emerald-500/25 px-1 rounded">Q</span>}
                                </div>
                                <span className={`font-bold tabular-nums ${isTop2 ? 'text-emerald-300' : 'text-slate-400'}`}>
                                  {item.prob.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Championship Leaderboards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-4">
                
                {/* Spotlight Favorite Column */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="border-b border-slate-800 pb-2">
                    <h5 className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Simulated Trophy Favorite</h5>
                  </div>

                  {top1 && (
                    <div className="bg-gradient-to-br from-yellow-950/20 via-slate-900 to-zinc-950 border border-yellow-500/30 p-6 rounded-2xl flex flex-col items-center text-center gap-4 shadow-xl relative overflow-hidden">
                      <div className="absolute -top-12 -right-12 p-8 opacity-5">
                        <Trophy className="w-48 h-48 text-yellow-500" />
                      </div>
                      
                      <div className="w-14 h-14 bg-yellow-500/15 border border-yellow-500/30 rounded-2xl flex items-center justify-center shadow-lg">
                        <Trophy className="w-7 h-7 text-yellow-400 animate-bounce" />
                      </div>

                      <div className="space-y-2">
                        <span className="text-[9px] font-mono text-yellow-500 font-bold uppercase tracking-widest block bg-yellow-500/10 border border-yellow-500/35 py-0.5 px-3 rounded-full">
                          Likeliest Tournament Champion
                        </span>
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <TeamFlag name={top1.team.name} height={20} className="rounded border border-white/5" />
                          <h4 className="text-2xl font-bold text-slate-100">{top1.team.name}</h4>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400">
                          Power index: Attack {top1.team.attack} | Defense {top1.team.defense} | Roster rank #{top1.team.ranking}
                        </p>
                      </div>

                      <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4 w-full">
                        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wide block">Simulated Win Share</span>
                        <div className="text-4xl font-black text-yellow-400 tabular-nums tracking-wide">{top1.prob.toFixed(2)}%</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Grid list leaderboard search for all 48 teams */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-2 gap-2">
                    <h5 className="font-mono text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">All 48 Nations: Real Championship Shares</h5>
                    <div className="relative w-full sm:w-48">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search team..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg py-1 px-2.5 pl-8 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-850 rounded-xl overflow-hidden shadow">
                    <div className="max-h-[380px] overflow-y-auto">
                      <table className="w-full text-xs font-mono text-slate-300">
                        <thead>
                          <tr className="bg-slate-950 text-[10px] text-slate-500 border-b border-slate-850 py-2.5 font-bold uppercase">
                            <th className="py-2.5 px-4 text-left">Seed Rank</th>
                            <th className="py-2.5 px-4 text-left">Nation</th>
                            <th className="py-2.5 px-4 text-center">Group Advance %</th>
                            <th className="py-2.5 px-4 text-right">World Cup Win %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/40">
                          {filteredChampionshipList.map((item, index) => (
                            <tr key={item.team.code} className="hover:bg-slate-850/20 transition">
                              <td className="py-2 px-4 text-slate-500">#{index + 1}</td>
                              <td className="py-2 px-4 flex items-center gap-2 font-semibold text-slate-200">
                                <TeamFlag name={item.team.name} height={11} className="rounded-xs border border-white/5" />
                                <span>{item.team.name}</span>
                              </td>
                              <td className="py-2 px-4 text-center text-slate-400">{item.advanceProb.toFixed(1)}%</td>
                              <td className="py-2 px-4 text-right font-bold text-emerald-400 tracking-wider tabular-nums">
                                {item.prob.toFixed(2)}%
                              </td>
                            </tr>
                          ))}
                          {filteredChampionshipList.length === 0 && (
                            <tr>
                              <td colSpan={4} className="text-center py-8 text-slate-500 uppercase text-[10px]">No nations match search credentials</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="text-center py-20 bg-slate-900/50 border border-slate-850 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 space-y-3">
              <AlertCircle className="w-8 h-8 text-slate-600" />
              <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">Statistical Model Pending Simulation Initializer</p>
              <button
                onClick={handleRun10kSimulations}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold uppercase text-xs rounded-lg transition"
              >
                Launch Initial 10,000 Runs
              </button>
            </div>
          )}

        </div>
      )}

      {/* OPTION B: SINGLE RUN SANDBOX PLAY-THROUGH */}
      {simulatorMode === 'single' && (
        <div className="space-y-6 animate-fade-in" id="single-sandbox-play-view">

          {/* Warning reset and mode indicator */}
          <div className="bg-[#171c26] border border-amber-500/20 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow" id="sandbox-warning-banner">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <div>
                <span className="text-[10px] text-amber-500 font-mono font-bold uppercase tracking-wider block">Sandbox Playground Mode</span>
                <p className="text-xs text-slate-350 font-semibold mt-0.5">One random simulation — results vary each run. Scores and standings belong only here.</p>
              </div>
            </div>
            <button
              id="sandbox-reset-bracket-btn"
              onClick={initializeTournament}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-xs font-mono text-slate-200 border border-slate-700 rounded-lg flex items-center justify-center gap-1 w-full sm:w-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Force Reset Bracket
            </button>
          </div>

          {/* Stepper active tab selector */}
          <div className="flex border-b border-slate-800">
            <button
              onClick={() => setActiveStage('groups')}
              className={`px-5 py-3 text-sm font-mono tracking-wider transition-all border-b-2 font-medium cursor-pointer ${
                activeStage === 'groups' ? 'border-emerald-500 text-emerald-400 font-semibold bg-emerald-500/5' : 'border-transparent text-slate-400 hover:text-slate-350'
              }`}
            >
              Group Standings
            </button>
            <button
              onClick={() => { if (groupsSimulated) setActiveStage('knockouts'); }}
              disabled={!groupsSimulated}
              className={`px-5 py-3 text-sm font-mono tracking-wider transition-all border-b-2 font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                activeStage === 'knockouts' ? 'border-emerald-500 text-emerald-400 font-semibold bg-emerald-500/5' : 'border-transparent text-slate-400 hover:text-slate-350'
              }`}
            >
              Knockout Bracket Tree
            </button>
          </div>

          {/* Group Stage view of Single run */}
          {activeStage === 'groups' && (
            <div className="space-y-6">
              {groups.length === 0 ? (
                <div className="text-center py-16 text-slate-500 font-mono text-sm uppercase">Initializing Sandbox...</div>
              ) : (
                <div className="space-y-6">
                  {!groupsSimulated && (
                    <div className="flex justify-center p-4">
                      <button
                        id="run-single-group-sim-btn"
                        onClick={handleSimulateGroups}
                        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold uppercase text-xs tracking-wider rounded-lg transition shadow shadow-emerald-500/10 cursor-pointer"
                      >
                        Simulate Group Stage
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {groups.map((group) => (
                      <div key={group.name} className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex flex-col justify-between shadow">
                        <div>
                          <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
                            <span className="font-mono text-slate-200 font-bold text-sm tracking-wider flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Group {group.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono uppercase font-medium">Standings</span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs font-mono">
                              <thead>
                                <tr className="text-slate-500 border-b border-slate-850">
                                  <th className="pb-1.5 font-medium">Team</th>
                                  <th className="pb-1.5 font-medium text-center">W-D-L</th>
                                  <th className="pb-1.5 font-medium text-center">GD</th>
                                  <th className="pb-1.5 font-medium text-right text-emerald-400 font-bold">Pts</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850/40 text-slate-350">
                                {group.standings.map((standing, index) => {
                                  const team = teams.find(t => t.code === standing.teamCode)!;
                                  const isAdvancing = index <= 1 && groupsSimulated;
                                  return (
                                    <tr key={standing.teamCode} className={`hover:bg-slate-850/10 transition ${isAdvancing ? 'text-emerald-400 font-semibold' : ''}`}>
                                      <td className="py-2 flex items-center gap-2">
                                        <TeamFlag name={team.name} height={11} className="shadow-xs rounded-xs border border-white/5" />
                                        <span className="truncate max-w-[80px]" title={team.name}>{team.code}</span>
                                        {isAdvancing && <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/25 px-1 rounded">Q</span>}
                                      </td>
                                      <td className="py-2 text-center text-slate-400">{standing.won}-{standing.drawn}-{standing.lost}</td>
                                      <td className="py-2 text-center text-slate-400">{standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference}</td>
                                      <td className={`py-2 text-right font-bold ${isAdvancing ? 'text-emerald-400' : 'text-slate-400'}`}>{standing.points}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* List group fixtures */}
                        <div className="border-t border-slate-850 pt-3 mt-4 space-y-1.5">
                          <span className="block text-[10px] text-slate-500 font-mono uppercase tracking-widest font-bold">Match results</span>
                          <div className="space-y-1">
                            {group.matches.map((match) => (
                              <div
                                key={match.id}
                                onClick={() => { if (match.played) setSelectedMatch(match); }}
                                className={`flex items-center justify-between text-[11px] font-mono p-1 rounded transition ${match.played ? 'hover:bg-slate-800 cursor-pointer text-slate-200' : 'text-slate-500'}`}
                              >
                                <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
                                  <TeamFlag name={match.teamA!.name} height={9} className="flex-shrink-0 rounded-xs" />
                                  <span className="truncate">{match.teamA!.code}</span>
                                </div>
                                <div className="px-1.5 py-0.5 font-bold text-center w-12 bg-slate-950/40 rounded border border-slate-850/40 text-slate-350 text-[10px]">
                                  {match.played ? `${match.scoreA}-${match.scoreB}` : 'vs'}
                                </div>
                                <div className="flex items-center gap-1.5 justify-end flex-1 overflow-hidden text-right">
                                  <span className="truncate">{match.teamB!.code}</span>
                                  <TeamFlag name={match.teamB!.name} height={9} className="flex-shrink-0 rounded-xs" />
                                </div>
                                {match.played && (
                                  <Eye className="w-2.5 h-2.5 text-slate-500 hover:text-emerald-400 ml-1 flex-shrink-0" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Knockout Brackets stage view for Single Run */}
          {activeStage === 'knockouts' && groupsSimulated && (
            <div className="space-y-6">

              {/* Champion Box Banner */}
              {champion && (
                <div className="bg-gradient-to-r from-yellow-600/10 via-yellow-500/20 to-yellow-600/10 border border-yellow-500/40 p-6 rounded-2xl text-center space-y-3 max-w-xl mx-auto shadow-xl">
                  <Trophy className="w-12 h-12 text-yellow-400 mx-auto animate-bounce" />
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-yellow-500 font-bold block">FIFA World Cup Sandbox Champion</span>
                    <div className="flex justify-center select-none py-1">
                      <TeamFlag name={champion.name} height={28} className="rounded border border-white/10" />
                    </div>
                    <h2 className="text-2xl font-sans font-extrabold text-slate-100 tracking-tight">{champion.name}</h2>
                    <span className="text-xs font-mono text-slate-400 block">Manager: {champion.manager}</span>
                  </div>
                </div>
              )}

              {/* Simulation Stepper Controls bar */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex flex-wrap justify-center items-center gap-3 w-full" id="knockout-sandbox-sim-controls">
                
                <button
                  onClick={() => simulateKnockoutRound(r16, 'quarter', setR16)}
                  disabled={r16.some(m => m.played)}
                  className="px-4 py-2 bg-slate-800 disabled:bg-slate-950 border border-slate-700/60 disabled:border-slate-850 text-xs font-mono text-slate-350 disabled:text-slate-500 rounded-lg hover:bg-slate-750 transition flex items-center gap-1.5 cursor-pointer"
                >
                  Simulate R16
                </button>

                <ChevronRight className="w-4 h-4 text-slate-600" />

                <button
                  onClick={() => simulateKnockoutRound(quarters, 'semi', setQuarters)}
                  disabled={r16.some(m => !m.played) || quarters.length === 0 || quarters.some(m => m.played)}
                  className="px-4 py-2 bg-slate-800 disabled:bg-slate-950 border border-slate-700/60 disabled:border-slate-850 text-xs font-mono text-slate-350 disabled:text-slate-500 rounded-lg hover:bg-slate-750 transition flex items-center gap-1.5 cursor-pointer"
                >
                  Simulate Quarterfinals
                </button>

                <ChevronRight className="w-4 h-4 text-slate-600" />

                <button
                  onClick={handleSimulateSemis}
                  disabled={quarters.length === 0 || quarters.some(m => !m.played) || semis.length === 0 || semis.some(m => m.played)}
                  className="px-4 py-2 bg-slate-800 disabled:bg-slate-950 border border-slate-700/60 disabled:border-slate-850 text-xs font-mono text-slate-350 disabled:text-slate-500 rounded-lg hover:bg-slate-750 transition flex items-center gap-1.5 cursor-pointer"
                >
                  Simulate Semifinals
                </button>

                <ChevronRight className="w-4 h-4 text-slate-600" />

                <button
                  onClick={handleSimulateFinal}
                  disabled={semis.length === 0 || semis.some(m => !m.played) || !finalMatch || finalMatch.played}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 text-slate-950 disabled:opacity-30 disabled:pointer-events-none rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
                >
                  Simulate World Cup Final
                </button>

              </div>

              {/* visual bracket trees view */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative select-none">
                
                {/* R16 column */}
                <div className="lg:col-span-3 space-y-4">
                  <span className="block text-[9px] font-mono text-slate-500 uppercase tracking-widest text-center border-b border-slate-850 pb-2">Round of 16</span>
                  <div className="space-y-3">
                    {r16.map(m => (
                      <div
                        key={m.id}
                        onClick={() => { if (m.played) setSelectedMatch(m); }}
                        className={`bg-slate-900 border border-slate-850 p-2.5 rounded-lg text-xs font-mono space-y-1 shadow ${m.played ? 'hover:bg-slate-800 cursor-pointer' : ''}`}
                      >
                        <div className="flex justify-between items-center text-[9px] text-slate-500 mb-1">
                          <span>#{m.id.replace('KO-R16-', '')}</span>
                          {m.played && <span className="text-emerald-400 font-bold uppercase">FT</span>}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                              {m.teamA ? <TeamFlag name={m.teamA.name} height={10} className="rounded-xs" /> : <span>🏳️</span>}
                              <span className={m.played && m.scoreA! < m.scoreB! ? 'text-slate-500' : 'text-slate-200'}>{m.teamA ? m.teamA.code : m.placeholderA}</span>
                            </div>
                            <span className="font-bold text-slate-200 bg-slate-950/40 px-1 rounded">{m.played ? m.scoreA : '-'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                              {m.teamB ? <TeamFlag name={m.teamB.name} height={10} className="rounded-xs" /> : <span>🏳️</span>}
                              <span className={m.played && m.scoreB! < m.scoreA! ? 'text-slate-550' : 'text-slate-300'}>{m.teamB ? m.teamB.code : m.placeholderB}</span>
                            </div>
                            <span className="font-bold text-slate-200 bg-slate-950/40 px-1 rounded">{m.played ? m.scoreB : '-'}</span>
                          </div>
                        </div>
                        {m.penaltiesWinner && (
                          <span className="block text-[8px] text-emerald-400 font-bold tracking-tight text-center border-t border-slate-850/45 pt-1 mt-1 uppercase">
                            ({m.scoreA_Pen}-{m.scoreB_Pen} pens)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quarters column */}
                <div className="lg:col-span-3 lg:pt-10 space-y-4">
                  <span className="block text-[9px] font-mono text-slate-500 uppercase tracking-widest text-center border-b border-slate-850 pb-2">Quarterfinals</span>
                  <div className="space-y-12">
                    {(quarters.length > 0 ? quarters : Array(4).fill(null)).map((m, idx) => (
                      <div
                        key={m ? m.id : `qf-null-${idx}`}
                        onClick={() => { if (m && m.played) setSelectedMatch(m); }}
                        className={`bg-slate-900 border border-slate-850 p-2.5 rounded-lg text-xs font-mono space-y-1 shadow ${m && m.played ? 'hover:bg-slate-800 cursor-pointer' : ''}`}
                      >
                        <div className="flex justify-between items-center text-[9px] text-slate-500 mb-1">
                          <span>QF #{idx + 1}</span>
                          {m && m.played && <span className="text-emerald-400 font-bold uppercase">FT</span>}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                              {m && m.teamA ? <TeamFlag name={m.teamA.name} height={10} className="rounded-xs" /> : <span>🏳️</span>}
                              <span className={m && m.played && m.scoreA! < m.scoreB! ? 'text-slate-500' : 'text-slate-200'}>{m && m.teamA ? m.teamA.code : `Winner R16 #${idx * 2 + 1}`}</span>
                            </div>
                            <span className="font-bold text-slate-200 bg-slate-950/40 px-1 rounded">{m && m.played ? m.scoreA : '-'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                              {m && m.teamB ? <TeamFlag name={m.teamB.name} height={10} className="rounded-xs" /> : <span>🏳️</span>}
                              <span className={m && m.played && m.scoreB! < m.scoreA! ? 'text-slate-550' : 'text-slate-350'}>{m && m.teamB ? m.teamB.code : `Winner R16 #${idx * 2 + 2}`}</span>
                            </div>
                            <span className="font-bold text-slate-200 bg-slate-950/40 px-1 rounded">{m && m.played ? m.scoreB : '-'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Semis column */}
                <div className="lg:col-span-3 lg:pt-28 space-y-4">
                  <span className="block text-[9px] font-mono text-slate-500 uppercase tracking-widest text-center border-b border-slate-850 pb-2">Semifinals</span>
                  <div className="space-y-28">
                    {(semis.length > 0 ? semis : Array(2).fill(null)).map((m, idx) => (
                      <div
                        key={m ? m.id : `sf-null-${idx}`}
                        onClick={() => { if (m && m.played) setSelectedMatch(m); }}
                        className={`bg-slate-900 border border-slate-850 p-2.5 rounded-lg text-xs font-mono space-y-1 shadow ${m && m.played ? 'hover:bg-slate-800 cursor-pointer' : ''}`}
                      >
                        <div className="flex justify-between items-center text-[9px] text-slate-500 mb-1">
                          <span>SF #{idx + 1}</span>
                          {m && m.played && <span className="text-emerald-400 font-bold uppercase">FT</span>}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                              {m && m.teamA ? <TeamFlag name={m.teamA.name} height={10} className="rounded-xs" /> : <span>🏳️</span>}
                              <span className={m && m.played && m.scoreA! < m.scoreB! ? 'text-slate-550' : 'text-slate-200'}>{m && m.teamA ? m.teamA.code : `Winner QF #${idx * 2 + 1}`}</span>
                            </div>
                            <span className="font-bold text-slate-200 bg-slate-950/40 px-1 rounded">{m && m.played ? m.scoreA : '-'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                              {m && m.teamB ? <TeamFlag name={m.teamB.name} height={10} className="rounded-xs" /> : <span>🏳️</span>}
                              <span className={m && m.played && m.scoreB! < m.scoreA! ? 'text-slate-550' : 'text-slate-300'}>{m && m.teamB ? m.teamB.code : `Winner QF #${idx * 2 + 2}`}</span>
                            </div>
                            <span className="font-bold text-slate-200 bg-slate-950/40 px-1 rounded">{m && m.played ? m.scoreB : '-'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Finals (Grand Final + 3rd place tie) */}
                <div className="lg:col-span-3 lg:pt-40 space-y-10">
                  
                  {/* Grand Final */}
                  <div className="space-y-2">
                    <span className="block text-[9px] font-mono text-slate-500 uppercase tracking-widest text-center border-b border-slate-850 pb-1.5">🏆 Grand Final</span>
                    
                    <div
                      onClick={() => { if (finalMatch && finalMatch.played) setSelectedMatch(finalMatch); }}
                      className={`bg-slate-900 border-2 ${finalMatch && finalMatch.played ? 'border-yellow-500/40 hover:bg-slate-805 cursor-pointer shadow-yellow-500/5' : 'border-slate-800'} p-3 rounded-lg text-xs font-mono space-y-1 shadow-lg`}
                    >
                      <div className="flex justify-between items-center text-[9px] text-yellow-500 font-bold uppercase mb-1">
                        <span>World Cup Final</span>
                        {finalMatch && finalMatch.played && <span className="text-emerald-405 font-black">FT</span>}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 truncate max-w-[124px]">
                            {finalMatch && finalMatch.teamA ? <TeamFlag name={finalMatch.teamA.name} height={10} className="rounded-xs" /> : <span>🏳️</span>}
                            <span className="text-slate-100 font-bold">{finalMatch && finalMatch.teamA ? finalMatch.teamA.code : 'Finalist 1'}</span>
                          </div>
                          <span className="font-bold text-slate-100 bg-slate-950/50 px-1.5 rounded">{finalMatch && finalMatch.played ? finalMatch.scoreA : '-'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 truncate max-w-[124px]">
                            {finalMatch && finalMatch.teamB ? <TeamFlag name={finalMatch.teamB.name} height={10} className="rounded-xs" /> : <span>🏳️</span>}
                            <span className="text-slate-100 font-bold">{finalMatch && finalMatch.teamB ? finalMatch.teamB.code : 'Finalist 2'}</span>
                          </div>
                          <span className="font-bold text-slate-100 bg-slate-950/50 px-1.5 rounded">{finalMatch && finalMatch.played ? finalMatch.scoreB : '-'}</span>
                        </div>
                      </div>

                      {finalMatch && finalMatch.penaltiesWinner && (
                        <span className="block text-[8px] text-yellow-500 font-bold tracking-tight text-center border-t border-slate-850/45 pt-1.5 mt-1.5 uppercase">
                          pens shootout ({finalMatch.scoreA_Pen}-{finalMatch.scoreB_Pen})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Third Place Match */}
                  {thirdPlaceMatch && (
                    <div className="space-y-2">
                      <span className="block text-[9px] font-mono text-slate-450 uppercase tracking-widest text-center border-b border-slate-850 pb-1.5">3rd Place Match</span>
                      <div
                        onClick={() => { if (thirdPlaceMatch.played) setSelectedMatch(thirdPlaceMatch); }}
                        className={`bg-slate-900 border border-slate-850 p-2.5 rounded-lg text-xs font-mono space-y-1 shadow ${thirdPlaceMatch.played ? 'hover:bg-slate-800 cursor-pointer' : ''}`}
                      >
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 truncate max-w-[120px] text-slate-400">
                              <TeamFlag name={thirdPlaceMatch.teamA!.name} height={10} />
                              <span>{thirdPlaceMatch.teamA!.code}</span>
                            </div>
                            <span className="font-bold text-slate-300 bg-slate-950/40 px-1 rounded">{thirdPlaceMatch.played ? thirdPlaceMatch.scoreA : '-'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 truncate max-w-[120px] text-slate-400">
                              <TeamFlag name={thirdPlaceMatch.teamB!.name} height={10} />
                              <span>{thirdPlaceMatch.teamB!.code}</span>
                            </div>
                            <span className="font-bold text-slate-300 bg-slate-950/40 px-1 rounded">{thirdPlaceMatch.played ? thirdPlaceMatch.scoreB : '-'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* MATCH INTERACTIVE INSPECTOR MODAL DETAIL */}
      {selectedMatch && selectedMatch.played && selectedMatch.prediction && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto relative animate-scale-up" id="match-modal">
            
            <button 
              id="close-inspector-modal-btn"
              onClick={() => setSelectedMatch(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 text-sm font-bold font-mono px-2 py-0.5 bg-slate-800 rounded border border-slate-700/60 cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center font-mono">
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest border border-emerald-500/30 px-2 py-0.5 bg-emerald-500/10 rounded">
                Fixture details: {selectedMatch.stage.toUpperCase()}{selectedMatch.groupName ? ` (Group ${selectedMatch.groupName})` : ''}
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3.5 bg-slate-950/50 rounded-xl border border-slate-850">
              <div className="text-center flex flex-col items-center">
                <TeamFlag name={selectedMatch.teamA!.name} height={20} className="rounded mb-1.5" />
                <span className="text-sm font-bold text-slate-100">{selectedMatch.teamA!.name}</span>
                <span className="block text-[9px] text-slate-500 font-mono">FIFA Rank #{selectedMatch.teamA!.ranking}</span>
              </div>

              <div className="text-center">
                <div className="text-2xl font-black text-white tabular-nums">
                  {selectedMatch.scoreA} - {selectedMatch.scoreB}
                </div>
                {selectedMatch.penaltiesWinner && (
                  <span className="text-[9px] text-emerald-405 font-bold uppercase font-mono block mt-1">
                    ({selectedMatch.scoreA_Pen}-{selectedMatch.scoreB_Pen} pens)
                  </span>
                )}
              </div>

              <div className="text-center flex flex-col items-center">
                <TeamFlag name={selectedMatch.teamB!.name} height={20} className="rounded mb-1.5" />
                <span className="text-sm font-bold text-slate-100">{selectedMatch.teamB!.name}</span>
                <span className="block text-[9px] text-slate-500 font-mono">FIFA Rank #{selectedMatch.teamB!.ranking}</span>
              </div>
            </div>

            {/* Simulated match stats */}
            <div className="space-y-2.5 bg-slate-950/20 p-3.5 rounded-xl border border-slate-850 font-mono text-xs">
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest">Match Metrics</span>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span>{selectedMatch.prediction.stats.possessionA}%</span>
                  <span className="text-[10px] text-slate-500 uppercase">Possession</span>
                  <span>{selectedMatch.prediction.stats.possessionB}%</span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full flex overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${selectedMatch.prediction.stats.possessionA}%` }} />
                  <div className="bg-slate-700 h-full" style={{ width: `${selectedMatch.prediction.stats.possessionB}%` }} />
                </div>

                <div className="flex justify-between items-center text-slate-400 pt-1">
                  <span>{selectedMatch.prediction.stats.shotsOnTargetA} ({selectedMatch.prediction.stats.shotsA})</span>
                  <span className="text-[10px] text-slate-500 uppercase">Shots (On Target)</span>
                  <span>{selectedMatch.prediction.stats.shotsOnTargetB} ({selectedMatch.prediction.stats.shotsB})</span>
                </div>
              </div>
            </div>

            {/* Event Timeline log */}
            <div className="space-y-1.5">
              <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">Chronological Highlights</span>
              <div className="h-32 overflow-y-auto border border-slate-850 p-3 rounded-lg space-y-1.5 bg-slate-950/30 text-[11px] leading-relaxed">
                {selectedMatch.prediction.timeline.map((evt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-emerald-400 font-mono font-bold w-6 text-center">{evt.minute}'</span>
                    <span className="text-slate-300 font-sans">{evt.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedMatch(null)}
              className="w-full py-2 bg-slate-850 hover:bg-slate-800 text-xs font-mono text-slate-300 font-bold uppercase rounded-lg border border-slate-800 transition cursor-pointer"
            >
              Close Inspector
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
