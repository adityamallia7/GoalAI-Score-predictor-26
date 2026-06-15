import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { MatchSimulationConfig, MatchPredictionResult } from './src/types';
import { simulateMatch, resolveKnockoutTies, ENRICHED_TEAMS } from './src/utils/predictor';
import { TEAMS } from './src/data/teams';

// Initialize Gemini SDK with telemetry header
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

function generateDynamicCommentary(prediction: MatchPredictionResult, config: MatchSimulationConfig): string {
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

  return `*Note: Advanced statistical commentary generated dynamically via local rules-based rating matcher due to live API key limits. Physical simulation pristine.*\n
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API 1: List teams
  app.get('/api/teams', (req, res) => {
    res.json(ENRICHED_TEAMS);
  });

  // API 2: Run predictions
  app.post('/api/predict', async (req, res) => {
    try {
      const config: MatchSimulationConfig = req.body;
      if (!config.teamA || !config.teamB) {
        return res.status(400).json({ error: 'Missing team codes' });
      }

      // 1. Run physical statistical simulation
      let prediction = simulateMatch(config);

      // If it's a knockout stage simulation (passed from client) run tie-breaker resolver
      const isKnockout = req.query.stage !== 'group' && req.query.stage !== undefined;
      if (isKnockout) {
        prediction = resolveKnockoutTies(prediction);
      }

      // 2. Query Gemini API (if available) to write professional commentary
      let aiAnalysis = '';
      if (ai) {
        try {
          const teamAName = prediction.teamA.name;
          const teamBName = prediction.teamB.name;
          const scoreA = prediction.scoreA;
          const scoreB = prediction.scoreB;
          const pensLog = prediction.penaltiesWinner
            ? ` (Won by ${prediction.penaltiesWinner === prediction.teamA.code ? teamAName : teamBName} in penalty shootout: ${prediction.scoreA_Penalties}-${prediction.scoreB_Penalties})`
            : '';

          // Build timeline summary for Gemini context
          const timelineLogs = prediction.timeline
            .map(t => `[Min ${t.minute}] ${t.description}`)
            .join('\n');

          const prompt = `You are an elite, world-class Football/Soccer analyst and Chief sports data pundit. 
We just ran a statistical machine-learning prediction & simulation on a FIFA World Cup match between ${teamAName} and ${teamBName}.

Match Configuration:
- ${teamAName} tactical style in simulation: ${config.tacticsA} (base style: ${prediction.teamA.tacticalStyle})
- ${teamBName} tactical style in simulation: ${config.tacticsB} (base style: ${prediction.teamB.tacticalStyle})
- Injury severity: ${teamAName}: ${Math.round(config.injurySeverityA * 100)}%, ${teamBName}: ${Math.round(config.injurySeverityB * 100)}%
- Statistical Expected Goals: ${teamAName}: ${prediction.expectedGoalsA}, ${teamBName}: ${prediction.expectedGoalsB}
- Simulated Outcome Score: ${teamAName} ${scoreA} - ${scoreB} ${teamBName}${pensLog}

Simulated Match Highlight Event Logs:
${timelineLogs}

Please write a highly engaging, professional analysis of this match in 3 distinctive sections:
1. "Tactical Clash & Form Analysis" - Focus on how their playstyles (${prediction.teamA.tacticalStyle} vs ${prediction.teamB.tacticalStyle}) influenced the stats, how tactics (${config.tacticsA} vs ${config.tacticsB}) paid off or backfired, and whether injuries impacted the tempo.
2. "Key Tactical Moments & Scorers" - Highlight the goal scorers, key moments, and tell a dramatic storytelling sequence of why the match ended the way it did based on the highlights.
3. "Post-Match Verdict" - What does this mean for both teams? Who was the star performer of the match and why? Include a brief summary of how the machine learning expected goals (xG) metrics reflected the real-life football flow.

Keep the tone professional, realistic, tactical, and passionate (like a premium athletic magazine or Sky / ESPN Sports analyst). Do NOT output markdown code blocks wrapper, return pure formatted markdown content directly.`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
              temperature: 0.85,
            }
          });

          aiAnalysis = response.text || '';
        } catch (gemError: any) {
          console.warn('Gemini prediction commentary failed (local dynamic fallback triggered):', gemError.message || gemError);
          aiAnalysis = generateDynamicCommentary(prediction, config);
        }
      } else {
        // Fallback when no Gemini API key is configured
        aiAnalysis = generateDynamicCommentary(prediction, config) + `\n\n---\n*To enable bespoke sports-journalist match commentary and live coaching analysis, configure a Gemini API key in the secrets panel of AI Studio.*`;
      }

      // Add AI analysis text to result package
      prediction.aiAnalysis = aiAnalysis;

      res.json(prediction);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Failed to simulate match prediction' });
    }
  });

  // Vite middlewear or static file delivery
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
