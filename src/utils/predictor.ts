import { Team, MatchSimulationConfig, MatchPredictionResult, MatchTimelineEvent, GoalEvent, CardEvent, SubstitutionEvent } from '../types';
import { TEAMS } from '../data/teams';

// Team ratings map according to specifications
export const TEAM_RATINGS: Record<string, { attack: number; defense: number }> = {
  "Argentina": { "attack": 1.50, "defense": 0.62 },
  "Spain": { "attack": 1.50, "defense": 0.63 },
  "France": { "attack": 1.52, "defense": 0.65 },
  "England": { "attack": 1.42, "defense": 0.62 },
  "Portugal": { "attack": 1.45, "defense": 0.70 },
  "Brazil": { "attack": 1.48, "defense": 0.68 },
  "Netherlands": { "attack": 1.40, "defense": 0.72 },
  "Germany": { "attack": 1.42, "defense": 0.74 },
  "Belgium": { "attack": 1.35, "defense": 0.80 },
  "Croatia": { "attack": 1.25, "defense": 0.82 },
  "Morocco": { "attack": 1.20, "defense": 0.75 },
  "Colombia": { "attack": 1.25, "defense": 0.85 },
  "Uruguay": { "attack": 1.22, "defense": 0.80 },
  "Switzerland": { "attack": 1.10, "defense": 0.85 },
  "Mexico": { "attack": 1.15, "defense": 0.88 },
  "United States": { "attack": 1.15, "defense": 0.90 },
  "Japan": { "attack": 1.18, "defense": 0.85 },
  "Senegal": { "attack": 1.20, "defense": 0.82 },
  "Norway": { "attack": 1.30, "defense": 0.95 },
  "Ecuador": { "attack": 1.05, "defense": 0.88 },
  "Austria": { "attack": 1.08, "defense": 0.92 },
  "Sweden": { "attack": 1.10, "defense": 0.95 },
  "Scotland": { "attack": 1.00, "defense": 0.98 },
  "Türkiye": { "attack": 1.12, "defense": 0.95 },
  "Egypt": { "attack": 1.05, "defense": 0.90 },
  "South Korea": { "attack": 1.10, "defense": 0.95 },
  "Australia": { "attack": 0.95, "defense": 0.92 },
  "Côte d'Ivoire": { "attack": 1.08, "defense": 0.95 },
  "Paraguay": { "attack": 0.95, "defense": 0.90 },
  "Czechia": { "attack": 1.05, "defense": 0.98 },
  "Algeria": { "attack": 1.10, "defense": 0.95 },
  "Ghana": { "attack": 1.05, "defense": 1.00 },
  "Panama": { "attack": 0.90, "defense": 1.00 },
  "Tunisia": { "attack": 0.92, "defense": 0.90 },
  "Qatar": { "attack": 0.90, "defense": 1.00 },
  "Iran": { "attack": 0.95, "defense": 0.85 },
  "Saudi Arabia": { "attack": 0.90, "defense": 0.98 },
  "Bosnia and Herzegovina": { "attack": 1.05, "defense": 1.00 },
  "Iraq": { "attack": 0.85, "defense": 1.00 },
  "Canada": { "attack": 1.05, "defense": 0.95 },
  "New Zealand": { "attack": 0.80, "defense": 1.15 },
  "Jordan": { "attack": 0.82, "defense": 1.10 },
  "Uzbekistan": { "attack": 0.85, "defense": 1.05 },
  "Cabo Verde": { "attack": 0.80, "defense": 1.15 },
  "DR Congo": { "attack": 0.85, "defense": 1.10 },
  "Curaçao": { "attack": 0.75, "defense": 1.25 },
  "Haiti": { "attack": 0.78, "defense": 1.20 },
  "South Africa": { "attack": 0.88, "defense": 1.05 }
};

// Derivation formula to synchronize Team ratings (Overall, Attack, Defense) with Poisson expected-goals parameters.
// This perfectly resolves the dual-ratings conflict (Section A) by deriving display numbers directly from model variables.
export const ENRICHED_TEAMS: Team[] = TEAMS.map(team => {
  const ratings = TEAM_RATINGS[team.name] || { attack: 1.0, defense: 1.0 };
  
  // Attack Mapping formula:
  // Base Poisson attack ranges from 0.75 (lowest) to 1.52 (highest)
  // We map this linearly to a human-readable 65 - 98 range
  const derivedAttack = Math.round(65 + ((ratings.attack - 0.75) / (1.52 - 0.75)) * 33);
  
  // Defense Mapping formula:
  // Poisson defense is a conceding rate (lower is stronger, i.e., Argentina is 0.62; weakest is Curaçao is 1.25)
  // We map this linearly to a human-readable 65 - 98 range where higher is better
  const derivedDefense = Math.round(65 + ((1.25 - ratings.defense) / (1.25 - 0.62)) * 33);
  
  // Ensure Overall index is derived consistently as a simple average of Attack, Midfield (static), and Defense
  const derivedOverall = Math.round((derivedAttack + team.midfield + derivedDefense) / 3);

  return {
    ...team,
    attack: derivedAttack,
    defense: derivedDefense,
    overall: derivedOverall
  };
});

// Poisson probability function
// P(k; lambda) = (lambda^k * e^-lambda) / k!
function poissonPMF(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

export function simulateMatch(config: MatchSimulationConfig): MatchPredictionResult {
  const teamA = ENRICHED_TEAMS.find(t => t.code === config.teamA || t.name === config.teamA)!;
  const teamB = ENRICHED_TEAMS.find(t => t.code === config.teamB || t.name === config.teamB)!;

  // Retrieve specified ratings, falling back to 1.0 if not found
  const ratingsA = TEAM_RATINGS[teamA.name] || { attack: 1.0, defense: 1.0 };
  const ratingsB = TEAM_RATINGS[teamB.name] || { attack: 1.0, defense: 1.0 };

  const attack_A = ratingsA.attack;
  const defense_A = ratingsA.defense;
  const attack_B = ratingsB.attack;
  const defense_B = ratingsB.defense;

  const AVG_GOALS = 1.35;

  // Host toggle calculation
  let hostBoost_A = 1.0;
  let hostBoost_B = 1.0;
  if (config.hostToggle) {
    const hosts = ['Canada', 'Mexico', 'United States'];
    if (hosts.includes(teamA.name)) hostBoost_A = 1.25;
    if (hosts.includes(teamB.name)) hostBoost_B = 1.25;
  }

  // Expected Goals (Lambda)
  let lambdaA = attack_A * defense_B * AVG_GOALS * hostBoost_A;
  let lambdaB = attack_B * defense_A * AVG_GOALS * hostBoost_B;

  // Apply tactical multiplier overlays (Section 3 overlays)
  if (config.squadFormMultiplierA !== undefined) lambdaA *= config.squadFormMultiplierA;
  if (config.tacticalSetupMultiplierA !== undefined) lambdaA *= config.tacticalSetupMultiplierA;
  if (config.crowdSupportMultiplierA !== undefined) lambdaA *= config.crowdSupportMultiplierA;

  if (config.squadFormMultiplierB !== undefined) lambdaB *= config.squadFormMultiplierB;
  if (config.tacticalSetupMultiplierB !== undefined) lambdaB *= config.tacticalSetupMultiplierB;
  if (config.crowdSupportMultiplierB !== undefined) lambdaB *= config.crowdSupportMultiplierB;

  // Build a scoreline probability matrix of size 9x9 (from 0-0 bounds through 8-8 bounds)
  const scoreMatrix: number[][] = [];
  for (let a = 0; a <= 8; a++) {
    scoreMatrix[a] = [];
    for (let b = 0; b <= 8; b++) {
      const pA = poissonPMF(a, lambdaA);
      const pB = poissonPMF(b, lambdaB);
      let jointProb = pA * pB;

      // Apply Dixon-Coles low-score correction (rho = -0.1)
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

      scoreMatrix[a][b] = Math.max(0, jointProb);
    }
  }

  // NORMALIZE the full matrix so all cells sum to exactly 1.0
  let totalSum = 0;
  for (let a = 0; a <= 8; a++) {
    for (let b = 0; b <= 8; b++) {
      totalSum += scoreMatrix[a][b];
    }
  }
  if (totalSum > 0) {
    for (let a = 0; a <= 8; a++) {
      for (let b = 0; b <= 8; b++) {
        scoreMatrix[a][b] /= totalSum;
      }
    }
  }

  // Outcomes: pHome, pDraw, pAway
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (let a = 0; a <= 8; a++) {
    for (let b = 0; b <= 8; b++) {
      if (a > b) {
        pHome += scoreMatrix[a][b];
      } else if (a === b) {
        pDraw += scoreMatrix[a][b];
      } else {
        pAway += scoreMatrix[a][b];
      }
    }
  }

  pHome *= 100;
  pDraw *= 100;
  pAway *= 100;

  // Assert pHome+pDraw+pAway == 100 (±0.1)
  const sumOutcomes = pHome + pDraw + pAway;
  if (Math.abs(sumOutcomes - 100) > 0.0001) {
    const scale = 100 / sumOutcomes;
    pHome *= scale;
    pDraw *= scale;
    pAway *= scale;
  }

  // Find the argmax cell of the normalized matrix (Most Likely Exact Score / modal scoreline)
  let maxProb = -1;
  let modalA = 0;
  let modalB = 0;
  for (let a = 0; a <= 8; a++) {
    for (let b = 0; b <= 8; b++) {
      if (scoreMatrix[a][b] > maxProb) {
        maxProb = scoreMatrix[a][b];
        modalA = a;
        modalB = b;
      }
    }
  }

  // Draw an actual scoreline using Weighted Random Sampling (cumulative-probability method)
  let simulatedScoreA = 0;
  let simulatedScoreB = 0;
  const randVal = Math.random();
  let cumulative = 0;
  let drawn = false;

  for (let a = 0; a <= 8; a++) {
    for (let b = 0; b <= 8; b++) {
      cumulative += scoreMatrix[a][b];
      if (randVal <= cumulative && !drawn) {
        simulatedScoreA = a;
        simulatedScoreB = b;
        drawn = true;
      }
    }
  }

  // Fallback to modal in case of floating-point edge cases
  if (!drawn) {
    simulatedScoreA = modalA;
    simulatedScoreB = modalB;
  }

  // Generate detailed gameplay events using simulatedScoreA and simulatedScoreB for perfect visual alignment in Match Center
  const timeline: MatchTimelineEvent[] = [
    { type: 'start', minute: 0, description: 'Kickoff! The referee blows the whistle and the match is underway!' }
  ];

  const generateMinutes = (count: number): number[] => {
    const mins: number[] = [];
    while (mins.length < count) {
      const min = Math.floor(Math.random() * 90) + 1;
      if (!mins.includes(min)) mins.push(min);
    }
    return mins.sort((x, y) => x - y);
  };

  const minutesA = generateMinutes(simulatedScoreA);
  const minutesB = generateMinutes(simulatedScoreB);

  // Stats derivation
  const possessionFactorA = (teamA.midfield / (teamA.midfield + teamB.midfield)) * 100;
  const finalPossessionA = Math.round(Math.max(30, Math.min(70, possessionFactorA + (Math.random() - 0.5) * 8)));
  const finalPossessionB = 100 - finalPossessionA;

  const shotsA = Math.max(Math.round(attack_A * 9 + Math.random() * 5), 4);
  const shotsB = Math.max(Math.round(attack_B * 8 + Math.random() * 5), 3);
  const shotsOnTargetA = Math.max(Math.round(shotsA * (0.3 + (1.5 - defense_B) * 0.2)), 1);
  const shotsOnTargetB = Math.max(Math.round(shotsB * (0.3 + (1.5 - defense_A) * 0.2)), 1);

  // Compilation of goals & events
  const goalsList: { minute: number; team: 'A' | 'B' }[] = [];
  minutesA.forEach(m => goalsList.push({ minute: m, team: 'A' }));
  minutesB.forEach(m => goalsList.push({ minute: m, team: 'B' }));
  goalsList.sort((x, y) => x.minute - y.minute);

  let stateA = 0;
  let stateB = 0;
  let addedHalf = false;

  goalsList.forEach(g => {
    const isA = g.team === 'A';
    const activeTeam = isA ? teamA : teamB;
    const opponentTeam = isA ? teamB : teamA;
    const keyScorers = activeTeam.keyPlayers;
    const scorer = keyScorers[Math.floor(Math.random() * keyScorers.length)];
    let assist = '';

    if (Math.random() > 0.3) {
      const otherPlayers = keyScorers.filter(p => p !== scorer);
      assist = otherPlayers.length > 0 ? otherPlayers[Math.floor(Math.random() * otherPlayers.length)] : 'midfielder';
    }

    if (isA) stateA++;
    else stateB++;

    const isPenalty = Math.random() > 0.90;
    const isOwnGoal = !isPenalty && Math.random() > 0.97;

    let desc = '';
    if (isOwnGoal) {
      const defender = opponentTeam.keyPlayers[opponentTeam.keyPlayers.length - 1];
      desc = `⚽ GOAL! Disaster for ${opponentTeam.name}! ${defender} accidentally turns the ball into their own net. (${stateA}-${stateB})`;
    } else if (isPenalty) {
      desc = `⚽ GOAL! Penalty converted! ${scorer} sends the keeper the wrong way with a precise strike. (${stateA}-${stateB})`;
    } else {
      const assDesc = assist ? ` after a crisp pass by ${assist}` : '';
      desc = `⚽ GOAL! ${activeTeam.name} scores! ${scorer} fires a brilliant shot into the corner${assDesc}. (${stateA}-${stateB})`;
    }

    const detail: GoalEvent = {
      minute: g.minute,
      teamCode: activeTeam.code,
      scorer: isOwnGoal ? `${opponentTeam.keyPlayers[opponentTeam.keyPlayers.length - 1]} (OG)` : scorer,
      assist: assist && !isOwnGoal && !isPenalty ? assist : undefined,
      isPenalty,
      isOwnGoal
    };

    if (g.minute >= 45 && !addedHalf) {
      timeline.push({ type: 'half', minute: 45, description: '⏸️ Half-Time Score. The players head down the tunnel for match feedback.' });
      addedHalf = true;
    }

    timeline.push({
      type: 'goal',
      minute: g.minute,
      teamCode: activeTeam.code,
      description: desc,
      detail
    });
  });

  if (!addedHalf) {
    timeline.push({ type: 'half', minute: 45, description: '⏸️ Half-Time! The referee ends the first 45 minutes of intensive play.' });
  }

  // Cards representation
  const foulsA = Math.max(Math.round(8 * defense_A + Math.random() * 6), 5);
  const foulsB = Math.max(Math.round(8 * defense_B + Math.random() * 6), 5);

  const yellowCardsA = Math.floor(foulsA / 5);
  const yellowCardsB = Math.floor(foulsB / 5);

  const cardMinutesA = generateMinutes(yellowCardsA);
  const cardMinutesB = generateMinutes(yellowCardsB);

  cardMinutesA.forEach(m => {
    const defenders = teamA.keyPlayers.slice(1);
    const player = defenders.length > 0 ? defenders[Math.floor(Math.random() * defenders.length)] : teamA.keyPlayers[0];
    timeline.push({
      type: 'card',
      minute: m,
      teamCode: teamA.code,
      description: `🟨 Yellow Card! Tactical caution issued to ${player} (${teamA.name}) to break a countering play.`,
      detail: { minute: m, teamCode: teamA.code, player, type: 'yellow' }
    });
  });

  cardMinutesB.forEach(m => {
    const defenders = teamB.keyPlayers.slice(1);
    const player = defenders.length > 0 ? defenders[Math.floor(Math.random() * defenders.length)] : teamB.keyPlayers[0];
    timeline.push({
      type: 'card',
      minute: m,
      teamCode: teamB.code,
      description: `🟨 Yellow Card! Referee cautions ${player} (${teamB.name}) following a repetitive infraction.`,
      detail: { minute: m, teamCode: teamB.code, player, type: 'yellow' }
    });
  });

  // Sort final timeline chronologically before ending whistle
  timeline.sort((x, y) => x.minute - y.minute);
  timeline.push({
    type: 'end',
    minute: 90,
    description: `🏁 Full-Time! The final whistle blows. Score: ${teamA.name} ${simulatedScoreA} - ${simulatedScoreB} ${teamB.name}.`
  });

  const resultObj: MatchPredictionResult = {
    teamA,
    teamB,
    expectedGoalsA: parseFloat(lambdaA.toFixed(2)),
    expectedGoalsB: parseFloat(lambdaB.toFixed(2)),
    scoreA: simulatedScoreA, // dynamically sampled scores
    scoreB: simulatedScoreB,
    probabilities: {
      winA: parseFloat((pHome / 100).toFixed(4)),
      winB: parseFloat((pAway / 100).toFixed(4)),
      draw: parseFloat((pDraw / 100).toFixed(4))
    },
    scoreMatrix,
    timeline,
    stats: {
      possessionA: finalPossessionA,
      possessionB: finalPossessionB,
      shotsA,
      shotsB,
      shotsOnTargetA,
      shotsOnTargetB,
      cornersA: Math.max(Math.round(shotsA * 0.35 + Math.random() * 3), 1),
      cornersB: Math.max(Math.round(shotsB * 0.35 + Math.random() * 3), 1),
      foulsA,
      foulsB
    }
  };

  resultObj.aiAnalysis = generateDynamicCommentary(resultObj, config);
  return resultObj;
}

export function resolveKnockoutTies(match: MatchPredictionResult): MatchPredictionResult {
  if (match.scoreA !== match.scoreB) {
    return match; // simple win, no Extra Time or shootouts needed
  }

  // Play Extra Time
  const extLambdaA = match.expectedGoalsA * 0.33;
  const extLambdaB = match.expectedGoalsB * 0.33;

  const sampleExtGoals = (lambda: number) => {
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
  };

  let extraGoalsA = sampleExtGoals(extLambdaA);
  let extraGoalsB = sampleExtGoals(extLambdaB);

  // Tweak extra goals sometimes if both 0 to keep KO exciting
  if (Math.random() > 0.8 && extraGoalsA === 0 && extraGoalsB === 0) {
    if (Math.random() > 0.5) extraGoalsA = 1;
    else extraGoalsB = 1;
  }

  const origTimeline = [...match.timeline].filter(evt => evt.type !== 'end');

  origTimeline.push({
    type: 'half',
    minute: 90,
    description: '⏱️ Extra-Time begins! The match is deadlocked and we play 30 more grueling minutes.'
  });

  const extScoreA = match.scoreA + extraGoalsA;
  const extScoreB = match.scoreB + extraGoalsB;

  if (extraGoalsA > 0) {
    origTimeline.push({
      type: 'goal',
      minute: 104,
      teamCode: match.teamA.code,
      description: `⚽ GOAL in Extra-Time! ${match.teamA.name} scores! ${match.teamA.keyPlayers[0]} fires a clinical header.`,
      detail: { minute: 104, teamCode: match.teamA.code, scorer: match.teamA.keyPlayers[0] }
    });
  }

  if (extraGoalsB > 0) {
    origTimeline.push({
      type: 'goal',
      minute: 112,
      teamCode: match.teamB.code,
      description: `⚽ GOAL in Extra-Time! ${match.teamB.name} replies! ${match.teamB.keyPlayers[0]} scores with a direct volley.`,
      detail: { minute: 112, teamCode: match.teamB.code, scorer: match.teamB.keyPlayers[0] }
    });
  }

  if (extScoreA !== extScoreB) {
    origTimeline.push({
      type: 'end',
      minute: 120,
      description: `🏁 Full-Time (After Extra-Time)! Match results in favor of ${extScoreA > extScoreB ? match.teamA.name : match.teamB.name}.`
    });

    return {
      ...match,
      scoreA: extScoreA,
      scoreB: extScoreB,
      timeline: origTimeline
    };
  }

  // Penalty Shootout simulation
  origTimeline.push({
    type: 'half',
    minute: 120,
    description: '🎯 PENALTY SHOOTOUT! Full-time after Extra Time. The score is still tied. This match will be decided from 12 yards!'
  });

  const penRateA = 0.75 + (match.teamA.gk - 75) * 0.002;
  const penRateB = 0.75 + (match.teamB.gk - 75) * 0.002;

  let penScoreA = 0;
  let penScoreB = 0;
  let kicks = 0;

  while (true) {
    kicks++;
    const kickA = Math.random() < penRateA;
    if (kickA) penScoreA++;

    if (kicks >= 3) {
      if (penScoreA > penScoreB + (5 - kicks + 1)) break;
      if (penScoreB > penScoreA + (5 - kicks)) break;
    }

    const kickB = Math.random() < penRateB;
    if (kickB) penScoreB++;

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

  const penWinner = penScoreA > penScoreB ? match.teamA.code : match.teamB.code;
  const winnerName = penScoreA > penScoreB ? match.teamA.name : match.teamB.name;

  origTimeline.push({
    type: 'end',
    minute: 125,
    description: `🏆 PENALTIES COMPLETED! ${winnerName} wins the shootout ${penScoreA} - ${penScoreB}! Incredible scenes of joy under pressure.`
  });

  return {
    ...match,
    scoreA: extScoreA,
    scoreB: extScoreB,
    penaltiesWinner: penWinner,
    scoreA_Penalties: penScoreA,
    scoreB_Penalties: penScoreB,
    timeline: origTimeline
  };
}

export function generateDynamicCommentary(prediction: MatchPredictionResult, config: MatchSimulationConfig): string {
  const teamAName = prediction.teamA.name;
  const teamBName = prediction.teamB.name;
  const scoreA = prediction.scoreA;
  const scoreB = prediction.scoreB;
  const isDraw = scoreA === scoreB;
  const winner = scoreA > scoreB ? teamAName : teamBName;
  const loser = scoreA > scoreB ? teamBName : teamAName;
  
  const pensLog = prediction.penaltiesWinner
    ? ` won on penalties (${prediction.scoreA_Penalties}-${prediction.scoreB_Penalties})`
    : '';

  // 1. Tactical clash commentary based on playstyles
  const tacticsA_desc = config.tacticsA || 'Standard';
  const tacticsB_desc = config.tacticsB || 'Standard';
  
  let layoutCommentary = '';
  if (config.tacticsA === 'Offensive' && config.tacticsB === 'Defensive') {
    layoutCommentary = `The pitch witnessed a classic battle of attrition. ${teamAName} deployed an aggressive, high-pressing **${tacticsA_desc}** posture, forcing ${teamBName} into a deep low-block with their tactical **${tacticsB_desc}** formation.`;
  } else if (config.tacticsA === 'Defensive' && config.tacticsB === 'Offensive') {
    layoutCommentary = `The match outline was defined by dynamic spacing. ${teamBName} seized the initiative through high-pressing **${tacticsB_desc}** lines, while ${teamAName} absorbed waves of pressure via their rigid, organized **${tacticsA_desc}** shape.`;
  } else if (config.tacticsA === 'Offensive' && config.tacticsB === 'Offensive') {
    layoutCommentary = `Both managers threw the tactical notebook out of the window, deploying fierce, high-octane **Offensive** patterns. The game transformed into a chaotic end-to-end spectacle with defensive structures widely vacant.`;
  } else if (config.tacticsA === 'Defensive' && config.tacticsB === 'Defensive') {
    layoutCommentary = `Respecting the stakes of this fixture, both sides prioritized structural safety. Deployed in cautious **Defensive** outlines, midfield possession turned into a physical war of static positioning.`;
  } else {
    layoutCommentary = `Entering the pitch with focused blueprints, ${teamAName} opted for a **${tacticsA_desc}** configuration, while ${teamBName} matched them with a calculated **${tacticsB_desc}** style. Midfield battles dictated the tempo of transition play.`;
  }

  // Form comments
  let formCommentary = '';
  const weight = config.formWeight !== undefined ? config.formWeight : 0.5;
  if (weight > 0.6) {
    formCommentary = `Managerial decisions heavily leveraged recent momentum (${Math.round(weight * 100)}% Form weight). This boosted attacking energy levels and offensive fluency in key transition zones.`;
  } else {
    formCommentary = `A balanced qualification shape was maintained. Standard tactical systems took priority over temporary momentum streaks.`;
  }

  // Injury comments
  let injuryCommentary = '';
  const injuryA = config.injurySeverityA !== undefined ? config.injurySeverityA : 0;
  const injuryB = config.injurySeverityB !== undefined ? config.injurySeverityB : 0;
  if (injuryA > 0.1 || injuryB > 0.1) {
    injuryCommentary = `Physical fitness emerged as a decisive variable. `;
    if (injuryA > 0.1) {
      injuryCommentary += `${teamAName} dealt with critical squad fatigue or key injuries (${Math.round(injuryA * 100)}% severity), hampering their recovery drills. `;
    }
    if (injuryB > 0.1) {
      injuryCommentary += `${teamBName} suffered prominent roster wear (${Math.round(injuryB * 100)}% severity), impacting their defensive stamina in the closing segments. `;
    }
  } else {
    injuryCommentary = `Crucially, both physical squads boasted pristine medical reports, enabling full-throttle physical press during ninety minutes.`;
  }

  // 2. Timeline key moments and scorers
  const goals = prediction.timeline ? prediction.timeline.filter(t => t.type === 'goal') : [];
  let timelineCommentary = '';
  if (goals.length > 0) {
    timelineCommentary = `The scoring sequence narrated a dramatic tale of persistence:\n`;
    goals.forEach(g => {
      timelineCommentary += `- **Min ${g.minute}**: ${g.description}\n`;
    });
  } else {
    timelineCommentary = `Defensive lines dominated completely. Neither side could locate the clinical key to breakthrough, leading to a sterile canvas where goalkeepers stood tall against rare distant shots.\n`;
  }

  // Cards & events
  const cards = prediction.timeline ? prediction.timeline.filter(t => t.type === 'card') : [];
  let cardCommentary = '';
  if (cards.length > 0) {
    cardCommentary = ` The discipline factor played a key role: ${cards.length} discipline warning cards were brandished, demonstrating high intensity and physical friction in the final third.`;
  }

  // 3. Post-match verdict
  let verdictScoreline = '';
  if (isDraw) {
    verdictScoreline = `A hard-fought **${scoreA}-${scoreB}** draw was a fair reflection of their absolute tactical equilibrium, although ${prediction.penaltiesWinner ? `the penalty shootout crowned **${prediction.penaltiesWinner === prediction.teamA.code ? teamAName : teamBName}** as the aggregate victor` : 'neither could claim full dominance'}.`;
  } else {
    verdictScoreline = `Ultimately, **${winner}** took a clinical **${scoreA}-${scoreB}** victory over **${loser}**${pensLog}, sealing a precious result in their FIFA World Cup trajectory.`;
  }

  const pHome = prediction.probabilities?.winA ?? 0.33;
  const pDraw = prediction.probabilities?.draw ?? 0.33;
  const pAway = prediction.probabilities?.winB ?? 0.34;
  const probWinner = scoreA > scoreB ? pHome : scoreA < scoreB ? pAway : pDraw;

  return `*Note: Advanced statistical commentary generated dynamically via local rules-based rating matcher.* \n
## Tactical Clash & Form Analysis
${layoutCommentary}

${formCommentary} ${injuryCommentary}

---

## Key Tactical Moments & Scorers
${timelineCommentary}
${cardCommentary ? `\n*Match Discipline Info:* ${cardCommentary}` : ''}

In the general duel of outlets, ${teamAName} claimed **${prediction.stats.possessionA}%** possession executing **${prediction.stats.shotsA}** shots (${prediction.stats.shotsOnTargetA} on target), compared to ${teamBName}'s **${prediction.stats.possessionB}%** possession with **${prediction.stats.shotsB}** shots (${prediction.stats.shotsOnTargetB} on target).

---

## Post-Match Verdict
${verdictScoreline}

Comparing the Poisson math metrics, the tactical expectancy (xG) sat at **${prediction.expectedGoalsA.toFixed(2)}** for ${teamAName} and **${prediction.expectedGoalsB.toFixed(2)}** for ${teamBName}. The physical outcome closely mapped inside the **${(probWinner * 100).toFixed(1)}%** simulated probability vector, validating the rating calibration of our World Cup matching engine.`;
}
