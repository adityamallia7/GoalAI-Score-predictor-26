export interface Team {
  code: string; // e.g., 'ARG', 'BRA'
  name: string;
  flag: string; // emoji or simple SVG path
  group: string; // 'A' | 'B' | ... | 'H'
  confederation: string; // CONMEBOL, UEFA, CAF, CONCACAF, AFC
  attack: number; // 50-99
  midfield: number; // 50-99
  defense: number; // 50-99
  gk: number; // 50-99
  overall: number; // average
  form: string[]; // e.g. ['W', 'D', 'W', 'W', 'L'] (recent 5 matches)
  ranking: number; // FIFA ranking
  titles: number; // World Cup trophies won
  appearances: number; // appearances in WC
  manager: string;
  tacticalStyle: string; // 'Tiki-Taka' | 'Counter-Attack' | 'Gegenpress' | 'Park the Bus' | 'Direct Play'
  keyPlayers: string[];
}

export interface MatchSimulationConfig {
  teamA: string;
  teamB: string;
  tacticsA: string; // 'Standard' | 'Offensive' | 'Defensive'
  tacticsB: string;
  formWeight: number; // 0 to 1
  injurySeverityA: number; // 0 to 1 (penalty to ratings)
  injurySeverityB: number; // 0 to 1
  neutralGround: boolean;
  hostToggle?: boolean;
  squadFormMultiplierA?: number;
  squadFormMultiplierB?: number;
  tacticalSetupMultiplierA?: number;
  tacticalSetupMultiplierB?: number;
  crowdSupportMultiplierA?: number;
  crowdSupportMultiplierB?: number;
  manual?: boolean;
}

export interface GoalEvent {
  minute: number;
  teamCode: string;
  scorer: string;
  assist?: string;
  isPenalty?: boolean;
  isOwnGoal?: boolean;
}

export interface CardEvent {
  minute: number;
  teamCode: string;
  player: string;
  type: 'yellow' | 'red';
}

export interface SubstitutionEvent {
  minute: number;
  teamCode: string;
  playerOut: string;
  playerIn: string;
}

export interface MatchTimelineEvent {
  type: 'goal' | 'card' | 'substitution' | 'injury' | 'half' | 'start' | 'end';
  minute: number;
  teamCode?: string;
  description: string;
  detail?: GoalEvent | CardEvent | SubstitutionEvent;
}

export interface MatchPredictionResult {
  teamA: Team;
  teamB: Team;
  expectedGoalsA: number;
  expectedGoalsB: number;
  scoreA: number;
  scoreB: number;
  penaltiesWinner?: string; // in case of knockout ties
  scoreA_Penalties?: number;
  scoreB_Penalties?: number;
  probabilities: {
    winA: number;
    winB: number;
    draw: number;
  };
  scoreMatrix: number[][]; // 6x6 score probability matrix
  timeline: MatchTimelineEvent[];
  stats: {
    possessionA: number;
    possessionB: number;
    shotsA: number;
    shotsB: number;
    shotsOnTargetA: number;
    shotsOnTargetB: number;
    cornersA: number;
    cornersB: number;
    foulsA: number;
    foulsB: number;
  };
  aiAnalysis?: string; // Loaded server-side by Gemini if key is provided
}

export interface GroupStanding {
  teamCode: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface Group {
  name: string; // 'A' | 'B' | ... | 'H'
  teams: Team[];
  standings: GroupStanding[];
  matches: TournamentMatch[];
}

export interface TournamentMatch {
  id: string; // e.g. 'G-A-1', 'R16-1'
  stage: 'group' | 'r16' | 'quarter' | 'semi' | 'third' | 'final';
  groupName?: string;
  teamA?: Team;
  teamB?: Team;
  placeholderA?: string; // used for knockout stage definitions e.g., 'Winner Group A'
  placeholderB?: string;
  played: boolean;
  scoreA?: number;
  scoreB?: number;
  penaltiesWinner?: string;
  scoreA_Pen?: number;
  scoreB_Pen?: number;
  prediction?: MatchPredictionResult;
}

export interface HistoricalChampion {
  year: number;
  host: string;
  champion: string;
  runnerUp: string;
  score: string;
  mvp: string;
}

export interface StoredPrediction {
  id: string;
  timestamp: string;
  teamA: Team;
  teamB: Team;
  predScoreline: string; // e.g. "2-1"
  pHome: number; // calculated home advantage win probability (out of 100)
  pDraw: number; // draw probability (out of 100)
  pAway: number; // away advantage win probability (out of 100)
  predictedOutcome: 'W' | 'D' | 'L'; // 'W' for Home Win, 'D' for Draw, 'L' for Away Win
  actualScoreline: string | null; // e.g. "2-1" or null if unresolved
  actualOutcome?: 'W' | 'D' | 'L' | null;
  resolved: boolean;
  manual?: boolean;
}

