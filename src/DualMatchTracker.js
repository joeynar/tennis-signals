import { useState, useEffect } from 'react';
import { supabase } from './supabase';

// Signal scoring logic — mirrors MatchTracker exactly
function calculateSignalScore(stats, thresholds) {
  if (!thresholds) return 0;

  const { servePct, set1Serve, set2Serve, doubleFaults, bpMissed,
    consecutivePoints, gamesLost, unforcedErrors, winners,
    secondServeWonPct, serviceHoldPct, aces, avgRallyLength,
    firstServeSpeed, bpCreated, setContext, situation,
    bodyLanguage, umpireDispute, thirdSetCollapse, bpCascade,
    lostBagel, secondServePressure } = stats;

  const baseline = thresholds.serve_baseline;
  const signalThresh = thresholds.signal_threshold;
  const warnThresh = thresholds.warn_threshold;

  // Serve score
  let serveScore = 0;
  if (servePct <= signalThresh) serveScore = 30;
  else if (servePct <= warnThresh) serveScore = 15;
  else if (servePct <= baseline - 3) serveScore = 5;

  // Double fault score
  let dfScore = 0;
  if (doubleFaults >= 3) dfScore = 20;
  else if (doubleFaults === 2) dfScore = 10;
  else if (doubleFaults === 1) dfScore = 3;

  // Momentum score
  let moScore = 0;
  if (consecutivePoints >= 6) moScore = 20;
  else if (consecutivePoints >= 4) moScore = 12;
  else if (consecutivePoints >= 3) moScore = 5;

  // Break points missed score
  let bpScore = 0;
  if (bpMissed >= 5) bpScore = 20;
  else if (bpMissed >= 3) bpScore = 10;
  else if (bpMissed >= 2) bpScore = 4;

  // Serve trend score
  let trendScore = 0;
  if (set1Serve > 0 && set2Serve > 0) {
    const drop = set1Serve - set2Serve;
    if (drop >= 15) trendScore = 27;
    else if (drop >= 10) trendScore = 16;
    else if (drop >= 5) trendScore = 9;
  }

  // Games lost score
  let gamesScore = 0;
  if (gamesLost >= 4) gamesScore = 20;
  else if (gamesLost >= 3) gamesScore = 12;
  else if (gamesLost >= 2) gamesScore = 5;
  if (secondServePressure) gamesScore += 12;

  // Winner-to-error ratio score
let werScore = 0;
const wer = winners / Math.max(unforcedErrors, 1);
if (wer < 0.5) werScore = 18;
else if (wer < 0.8) werScore = 12;
else if (wer < 1.0) werScore = 6;

// Second serve weakness
let s2Score = 0;
if (secondServeWonPct <= 35) s2Score = 15;
else if (secondServeWonPct <= 42) s2Score = 8;
else if (secondServeWonPct <= 48) s2Score = 4;

// Service hold collapse
let holdScore = 0;
if (serviceHoldPct <= 50) holdScore = 18;
else if (serviceHoldPct <= 65) holdScore = 10;
else if (serviceHoldPct <= 75) holdScore = 4;
  
// Pressure efficiency
let pressureScore = 0;
if (bpCreated >= 5 && bpMissed >= 4) pressureScore = 12;
else if (bpCreated >= 3 && bpMissed >= 3) pressureScore = 6;

// Rally length mismatch
let rallyScore = 0;
if (avgRallyLength >= 7) rallyScore = 8;
else if (avgRallyLength >= 5) rallyScore = 4;

// Serve speed drop
let speedScore = 0;
if (firstServeSpeed <= 160) speedScore = 10;
else if (firstServeSpeed <= 170) speedScore = 5;
// Psychology flags
  let flagScore = 0;
  if (bodyLanguage) flagScore += 8;
  if (bpCascade) flagScore += 10;
  if (umpireDispute) flagScore += 15;
  if (lostBagel) flagScore += 12;
  if (thirdSetCollapse) flagScore += 18;

  // Set context multiplier
  const setMult = setContext === '3rd set' ? 1.8 : setContext === '2nd set' ? 1.3 : 1.0;

  // Situation multiplier
  const sitMult = situation === 'Serving for set/tiebreak' ? 2.0
    : situation === 'Leading, opp broke back' ? 1.5
    : situation === 'Serving to stay in set' ? 1.3 : 1.0;

    const raw = serveScore + dfScore + moScore + bpScore + trendScore + gamesScore + werScore + s2Score + holdScore + pressureScore + rallyScore + speedScore;
  const total = Math.min(100, Math.round(raw * setMult * sitMult * 0.6 + flagScore));
  return total;
}

// Default stats object for each player panel
function defaultStats(baseline) {
  return {
    servePct: baseline || 65,
    set1Serve: 0,
    set2Serve: 0,
    doubleFaults: 0,
    bpMissed: 0,
    consecutivePoints: 0,
    gamesLost: 0,
    unforcedErrors: 0,
    winners: 0,
    secondServeWonPct: 50,
    serviceHoldPct: 75,
    aces: 0,
    avgRallyLength: 4,
    firstServeSpeed: 180,
    bpCreated: 0,
    setContext: '1st set',
    situation: 'Normal',
    bodyLanguage: false,
    umpireDispute: false,
    thirdSetCollapse: false,
    bpCascade: false,
    lostBagel: false,
    secondServePressure: false
  };
}

// Individual player panel component
function PlayerPanel({ player, thresholds, stats, onChange, side }) {
  const score = calculateSignalScore(stats, thresholds);
  const baseline = thresholds?.serve_baseline || 65;

  const alertColor = score >= 75 ? '#e53935' : score >= 60 ? '#ff9800' : score >= 35 ? '#9e9e9e' : '#f5f5f5';
  const alertText = score >= 75 ? 'HIGH CONFIDENCE — Act now'
    : score >= 60 ? 'SIGNAL CONFIRMED'
    : score >= 35 ? 'WATCH — Pattern building'
    : 'Monitoring...';

  function toggle(flag) {
    onChange({ ...stats, [flag]: !stats[flag] });
  }

  function slider(label, field, min, max, suffix = '') {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{label}</div>
        <input type="range" min={min} max={max} value={stats[field]}
          onChange={e => onChange({ ...stats, [field]: Number(e.target.value) })}
          style={{ width: '100%', accentColor: '#e53935' }} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>{stats[field]}{suffix}</div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, minWidth: 0, padding: '16px', border: '1px solid #eee',
      borderRadius: 12, background: '#fff'
    }}>
      {/* Player header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{player?.name}</div>
        <div style={{ fontSize: 12, color: '#888' }}>
          Ranked #{player?.ranking} · {player?.nationality} · Clay baseline {baseline}%
        </div>
      </div>

      {/* Signal score */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: alertColor, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 11, color: '#888' }}>signal score</div>
      </div>

      {/* Alert banner */}
      <div style={{
        padding: '10px 12px', borderRadius: 8, marginBottom: 16,
        background: score >= 75 ? '#e53935' : score >= 60 ? '#ff9800' : '#f5f5f5',
        color: score >= 35 ? 'white' : '#999', fontSize: 12, fontWeight: 600
      }}>
        {alertText}
      </div>

      {/* Sliders */}
      {slider(`First serve % — baseline ${baseline}% · signal below ${thresholds?.signal_threshold}%`, 'servePct', 30, 85, '%')}
      {slider('Set 1 first serve % (trend)', 'set1Serve', 30, 85, '%')}
      {slider('Set 2 first serve % (trend)', 'set2Serve', 30, 85, '%')}
      {slider('Double faults this set', 'doubleFaults', 0, 10)}
      {slider('Break points missed', 'bpMissed', 0, 10)}
      {slider('Consecutive points lost', 'consecutivePoints', 0, 10)}
      {slider('Games lost in a row', 'gamesLost', 0, 8)}
      {slider('Unforced errors this set', 'unforcedErrors', 0, 20)}
{slider('Winners this set', 'winners', 0, 20)}
<div style={{ fontSize: 11, color: '#999', marginTop: -8, marginBottom: 14 }}>
  W/E ratio: {(stats.winners / Math.max(stats.unforcedErrors, 1)).toFixed(2)}
</div>
{slider('2nd serve points won %', 'secondServeWonPct', 20, 80, '%')}
{slider('Service hold % this match', 'serviceHoldPct', 30, 100, '%')}

{slider('Aces this set', 'aces', 0, 15)}
{slider('Average rally length (shots)', 'avgRallyLength', 1, 12)}
{slider('First serve speed (km/h)', 'firstServeSpeed', 140, 220)}
{slider('Break points created this set', 'bpCreated', 0, 12)}
<div style={{ fontSize: 11, color: '#999', marginTop: -8, marginBottom: 14 }}>
  BP converted: {Math.max(0, stats.bpCreated - stats.bpMissed)}
</div>

      {/* Set context */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Set</div>
        <select value={stats.setContext}
          onChange={e => onChange({ ...stats, setContext: e.target.value })}
          style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
          <option>1st set</option>
          <option>2nd set</option>
          <option>3rd set</option>
        </select>
      </div>

      {/* Situation */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Situation</div>
        <select value={stats.situation}
          onChange={e => onChange({ ...stats, situation: e.target.value })}
          style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
          <option>Normal</option>
          <option>Serving to stay in set</option>
          <option>Leading, opp broke back</option>
          <option>Serving for set/tiebreak</option>
        </select>
      </div>

      {/* Psychology flags */}
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Psychology flags</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[
          ['bodyLanguage', 'Body language'],
          ['umpireDispute', 'Umpire dispute'],
          ['thirdSetCollapse', '3rd set collapse'],
          ['bpCascade', 'BP cascade'],
          ['lostBagel', 'Lost set 6-0/6-1'],
          ['secondServePressure', '2nd serve pressure']
        ].map(([key, label]) => (
          <button key={key} onClick={() => toggle(key)}
            style={{
              padding: '8px 4px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: `1px solid ${stats[key] ? '#e53935' : '#ddd'}`,
              background: stats[key] ? '#ffebee' : '#fafafa',
              color: stats[key] ? '#e53935' : '#666', cursor: 'pointer'
            }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Main dual tracker component
export default function DualMatchTracker({ onBack }) {
  const [players, setPlayers] = useState([]);
  const [playerAId, setPlayerAId] = useState('');
  const [playerBId, setPlayerBId] = useState('');
  const [playerA, setPlayerA] = useState(null);
  const [playerB, setPlayerB] = useState(null);
  const [thresholdsA, setThresholdsA] = useState(null);
  const [thresholdsB, setThresholdsB] = useState(null);
  const [statsA, setStatsA] = useState(defaultStats(65));
  const [statsB, setStatsB] = useState(defaultStats(65));
  const [h2h, setH2H] = useState(null);
  const [tournament, setTournament] = useState('');
  const [prediction, setPrediction] = useState('');
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [matchesA, setMatchesA] = useState([]);
  const [matchesB, setMatchesB] = useState([]);
  const [tournamentOptions, setTournamentOptions] = useState([]);
const [tournamentProfile, setTournamentProfile] = useState(null);
const [setsA, setSetsA] = useState(0);
const [setsB, setSetsB] = useState(0);
const [gamesA, setGamesA] = useState(0);
const [gamesB, setGamesB] = useState(0);
const [pointsA, setPointsA] = useState(0);
const [pointsB, setPointsB] = useState(0);
const [matchContext, setMatchContext] = useState('');
const [whoServesFirst, setWhoServesFirst] = useState('A'); // 'A' or 'B'
const [breakHistory, setBreakHistory] = useState([]);
const [prevGames, setPrevGames] = useState({ a: 0, b: 0, set: 1 });
const [prematchResearch, setPrematchResearch] = useState(null);
const [liveMatchId, setLiveMatchId] = useState(null);
const [liveConnected, setLiveConnected] = useState(false);
const [lastUpdated, setLastUpdated] = useState(null);

  // Load all players on mount
  useEffect(() => {
    supabase.from('players').select('id, name, ranking, nationality, hand, style_notes, collapse_triggers')
      .order('name').then(({ data }) => { if (data) setPlayers(data); });
  }, []);
  useEffect(() => {
    supabase
      .from('tournament_profiles')
      .select('id, tournament_name, year')
      .order('tournament_name')
      .then(({ data }) => { if (data) setTournamentOptions(data); });
  }, []);

  // Load Player A data when selected
  useEffect(() => {
    if (!playerAId) return;
    const p = players.find(x => x.id === playerAId);
    setPlayerA(p);
    setStatsA(defaultStats(65));
    setPrediction('');

    supabase.from('signal_thresholds').select('*')
      .eq('player_id', playerAId).eq('surface', 'clay').single()
      .then(({ data }) => {
        if (data) {
          setThresholdsA(data);
          setStatsA(defaultStats(data.serve_baseline));
        }
      });

    supabase.from('player_stats').select('*')
      .eq('player_id', playerAId).eq('surface', 'clay')
      .order('match_date', { ascending: false }).limit(10)
      .then(({ data }) => { if (data) setMatchesA(data); });
  }, [playerAId]);

  // Load Player B data when selected
  useEffect(() => {
    if (!playerBId) return;
    const p = players.find(x => x.id === playerBId);
    setPlayerB(p);
    setStatsB(defaultStats(65));
    setPrediction('');

    supabase.from('signal_thresholds').select('*')
      .eq('player_id', playerBId).eq('surface', 'clay').single()
      .then(({ data }) => {
        if (data) {
          setThresholdsB(data);
          setStatsB(defaultStats(data.serve_baseline));
        }
      });

    supabase.from('player_stats').select('*')
      .eq('player_id', playerBId).eq('surface', 'clay')
      .order('match_date', { ascending: false }).limit(10)
      .then(({ data }) => { if (data) setMatchesB(data); });
  }, [playerBId]);

  // Load H2H when both players selected
  useEffect(() => {
    if (!playerAId || !playerBId) return;
    supabase.from('head_to_head').select('*')
      .or(
        `and(player_a_id.eq.${playerAId},player_b_id.eq.${playerBId}),` +
        `and(player_a_id.eq.${playerBId},player_b_id.eq.${playerAId})`
      ).single()
      .then(({ data }) => { setH2H(data || null); });
  }, [playerAId, playerBId]);
  // Real-time listener for live match data
useEffect(() => {
  if (!liveMatchId) return;

  // Subscribe to changes in live_match table
  const subscription = supabase
    .channel('live-match-channel')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'live_match',
      filter: `match_id=eq.${liveMatchId}`
    }, (payload) => {
      const data = payload.new;
      if (!data) return;

      // Update scores
      setSetsA(data.sets_a || 0);
      setSetsB(data.sets_b || 0);
      setGamesA(data.games_a || 0);
      setGamesB(data.games_b || 0);

      // Update Player A sliders
      if (data.a_first_serve_pct) {
        setStatsA(prev => ({
          ...prev,
          servePct: data.a_first_serve_pct,
          doubleFaults: data.a_double_faults || prev.doubleFaults,
          aces: data.a_aces || prev.aces,
          winners: data.a_winners || prev.winners,
          unforcedErrors: data.a_unforced_errors || prev.unforcedErrors,
          bpMissed: data.a_bp_faced ? (data.a_bp_faced - data.a_bp_won) : prev.bpMissed,
          bpCreated: data.a_bp_faced || prev.bpCreated,
          secondServeWonPct: data.a_second_serve_won_pct || prev.secondServeWonPct,
          serviceHoldPct: data.a_service_games_played > 0
            ? Math.round((data.a_service_games_won / data.a_service_games_played) * 100)
            : prev.serviceHoldPct
        }));
      }

      // Update Player B sliders
      if (data.b_first_serve_pct) {
        setStatsB(prev => ({
          ...prev,
          servePct: data.b_first_serve_pct,
          doubleFaults: data.b_double_faults || prev.doubleFaults,
          aces: data.b_aces || prev.aces,
          winners: data.b_winners || prev.winners,
          unforcedErrors: data.b_unforced_errors || prev.unforcedErrors,
          bpMissed: data.b_bp_faced ? (data.b_bp_faced - data.b_bp_won) : prev.bpMissed,
          bpCreated: data.b_bp_faced || prev.bpCreated,
          secondServeWonPct: data.b_second_serve_won_pct || prev.secondServeWonPct,
          serviceHoldPct: data.b_service_games_played > 0
            ? Math.round((data.b_service_games_won / data.b_service_games_played) * 100)
            : prev.serviceHoldPct
        }));
      }

      setLastUpdated(new Date().toISOString());
      setLiveConnected(true);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}, [liveMatchId]);
  // Load pre-match research when both players selected
useEffect(() => {
  if (!playerAId || !playerBId) return;
  supabase.from('prematch_research').select('*')
    .or(
      `and(player_a_id.eq.${playerAId},player_b_id.eq.${playerBId}),` +
      `and(player_a_id.eq.${playerBId},player_b_id.eq.${playerAId})`
    )
    .order('match_date', { ascending: false })
    .limit(1)
    .maybeSingle()
    .then(({ data }) => { setPrematchResearch(data || null); });
}, [playerAId, playerBId]);

  function resetMatch() {
    setStatsA(defaultStats(thresholdsA?.serve_baseline || 65));
    setStatsB(defaultStats(thresholdsB?.serve_baseline || 65));
    setSetsA(0); setSetsB(0);
    setGamesA(0); setGamesB(0);
    setPointsA(0); setPointsB(0);
    setMatchContext('');
    setPrediction('');
    setBreakHistory([]);
setPrevGames({ a: 0, b: 0, set: 1 });
setPrematchResearch(null);
  }
  useEffect(() => {
    // Determine current set from sum of all sets played + 1
    const currentSet = setsA + setsB + 1;
    
    if (currentSet !== prevGames.set) {
      setPrevGames({ a: gamesA, b: gamesB, set: currentSet });
      return;
    }
    
    const aGameUp = gamesA > prevGames.a;
    const bGameUp = gamesB > prevGames.b;
    
    if (aGameUp || bGameUp) {
      const totalGamesBefore = prevGames.a + prevGames.b;
      const gameNumber = totalGamesBefore + 1;
      
      const aServesThisGame = whoServesFirst === 'A'
        ? gameNumber % 2 === 1
        : gameNumber % 2 === 0;
      
      if (aGameUp && !aServesThisGame) {
        // A won B's serve — B got broken
        setBreakHistory(prev => [...prev, {
          set: currentSet,
          gameNumber: gameNumber,
          brokenPlayer: 'B',
          score: `${gamesA}-${gamesB}`,
          timestamp: new Date().toISOString()
        }]);
      } else if (bGameUp && aServesThisGame) {
        // B won A's serve — A got broken
        setBreakHistory(prev => [...prev, {
          set: currentSet,
          gameNumber: gameNumber,
          brokenPlayer: 'A',
          score: `${gamesA}-${gamesB}`,
          timestamp: new Date().toISOString()
        }]);
      }
      
      setPrevGames({ a: gamesA, b: gamesB, set: currentSet });
    }
  }, [gamesA, gamesB, setsA, setsB]);
  const scoreA = calculateSignalScore(statsA, thresholdsA);
  const scoreB = calculateSignalScore(statsB, thresholdsB);
  function getBreakSummary() {
    if (breakHistory.length === 0) return null;
    const aBreaks = breakHistory.filter(b => b.brokenPlayer === 'A');
    const bBreaks = breakHistory.filter(b => b.brokenPlayer === 'B');
    const currentSet = setsA + setsB + 1;
    const currentSetBreaks = breakHistory.filter(b => b.set === currentSet);
    return {
      total: breakHistory.length,
      aBreaks: aBreaks.length,
      bBreaks: bBreaks.length,
      currentSet: currentSetBreaks.length,
      aBrokenAt: aBreaks.map(b => `Set ${b.set} game ${b.gameNumber} (${b.score})`).join(', '),
      bBrokenAt: bBreaks.map(b => `Set ${b.set} game ${b.gameNumber} (${b.score})`).join(', ')
    };
  }
  async function getDualPrediction() {
    if (!playerA || !playerB) return;
    setLoadingPrediction(true);
    setPrediction('');
const tournamentContext = tournamentProfile
  ? `Surface: ${tournamentProfile.surface} | Speed: ${tournamentProfile.surface_speed} | Conditions: ${tournamentProfile.conditions_narrative} | Upgrade: ${tournamentProfile.upgrade_profile} | Downgrade: ${tournamentProfile.downgrade_profile} | Live triggers: ${tournamentProfile.live_triggers}`
  : 'No tournament profile loaded';

const prompt = `
You are a live tennis betting analyst. Analyze both players in this match and provide a dual assessment.

TOURNAMENT: ${tournament || 'Unknown'}
TOURNAMENT CONTEXT: ${tournamentContext}

CURRENT SCORE: Sets ${setsA}-${setsB} | Games ${gamesA}-${gamesB} | Points ${['0','15','30','40','AD'][pointsA]}-${['0','15','30','40','AD'][pointsB]}
MATCH CONTEXT: ${matchContext || 'None provided'}
BREAK HISTORY: ${getBreakSummary() ? `Total breaks: ${getBreakSummary().total}. ${playerA.name} got broken at: ${getBreakSummary().aBrokenAt || 'none'}. ${playerB.name} got broken at: ${getBreakSummary().bBrokenAt || 'none'}. Current set breaks: ${getBreakSummary().currentSet}` : 'No breaks yet'}
PRE-MATCH RESEARCH: ${prematchResearch ? `MODEL VERDICT: ${prematchResearch.model_verdict}. Model probabilities - ${playerA.name}: ${prematchResearch.model_prob_a ? Math.round(prematchResearch.model_prob_a * 100) : '?'}%, ${playerB.name}: ${prematchResearch.model_prob_b ? Math.round(prematchResearch.model_prob_b * 100) : '?'}%. Market probabilities - ${playerA.name}: ${prematchResearch.market_prob_a ? Math.round(prematchResearch.market_prob_a * 100) : '?'}%, ${playerB.name}: ${prematchResearch.market_prob_b ? Math.round(prematchResearch.market_prob_b * 100) : '?'}%. Market error: ${prematchResearch.market_error_pp}pp. Primary bet: ${prematchResearch.primary_bet}. Live triggers: ${prematchResearch.live_triggers}. ${playerA.name} form: ${prematchResearch.player_a_form_summary}. ${playerB.name} form: ${prematchResearch.player_b_form_summary}` : 'No pre-match research loaded'}

--- PLAYER A: ${playerA.name} ---
Ranking: ${playerA.ranking} | Nationality: ${playerA.nationality}
Style: ${playerA.style_notes || 'No notes'}
Collapse triggers: ${JSON.stringify(playerA.collapse_triggers)}
Clay baseline serve: ${thresholdsA?.serve_baseline}% | Signal threshold: ${thresholdsA?.signal_threshold}%
Last 10 clay matches: ${JSON.stringify(matchesA)}
LIVE STATS RIGHT NOW:
- First serve: ${statsA.servePct}%
- Double faults: ${statsA.doubleFaults}
- BP missed: ${statsA.bpMissed}
- Consecutive points lost: ${statsA.consecutivePoints}
- Games lost in a row: ${statsA.gamesLost}
- Unforced errors: ${statsA.unforcedErrors} | Winners: ${statsA.winners} (W/E ratio: ${(statsA.winners / Math.max(statsA.unforcedErrors, 1)).toFixed(2)})
- 2nd serve won: ${statsA.secondServeWonPct}% | Service hold: ${statsA.serviceHoldPct}%
- Aces: ${statsA.aces} | Avg rally length: ${statsA.avgRallyLength} shots
- 1st serve speed: ${statsA.firstServeSpeed} km/h | BP created: ${statsA.bpCreated} (converted: ${Math.max(0, statsA.bpCreated - statsA.bpMissed)})
- Set: ${statsA.setContext} | Situation: ${statsA.situation}
- Active psychology flags: ${Object.entries({
  'Body language': statsA.bodyLanguage,
  'Umpire dispute': statsA.umpireDispute,
  '3rd set collapse': statsA.thirdSetCollapse,
  'BP cascade': statsA.bpCascade,
  'Lost bagel': statsA.lostBagel,
  '2nd serve pressure': statsA.secondServePressure
}).filter(([, v]) => v).map(([k]) => k).join(', ') || 'None'}
Signal score: ${scoreA}/100

--- PLAYER B: ${playerB.name} ---
Ranking: ${playerB.ranking} | Nationality: ${playerB.nationality}
Style: ${playerB.style_notes || 'No notes'}
Collapse triggers: ${JSON.stringify(playerB.collapse_triggers)}
Clay baseline serve: ${thresholdsB?.serve_baseline}% | Signal threshold: ${thresholdsB?.signal_threshold}%
Last 10 clay matches: ${JSON.stringify(matchesB)}
LIVE STATS RIGHT NOW:
- First serve: ${statsB.servePct}%
- Double faults: ${statsB.doubleFaults}
- BP missed: ${statsB.bpMissed}
- Consecutive points lost: ${statsB.consecutivePoints}
- Games lost in a row: ${statsB.gamesLost}
- Unforced errors: ${statsB.unforcedErrors} | Winners: ${statsB.winners} (W/E ratio: ${(statsB.winners / Math.max(statsB.unforcedErrors, 1)).toFixed(2)})
- 2nd serve won: ${statsB.secondServeWonPct}% | Service hold: ${statsB.serviceHoldPct}%
- Aces: ${statsB.aces} | Avg rally length: ${statsB.avgRallyLength} shots
- 1st serve speed: ${statsB.firstServeSpeed} km/h | BP created: ${statsB.bpCreated} (converted: ${Math.max(0, statsB.bpCreated - statsB.bpMissed)})
- Set: ${statsB.setContext} | Situation: ${statsB.situation}
- Active psychology flags: ${Object.entries({
  'Body language': statsB.bodyLanguage,
  'Umpire dispute': statsB.umpireDispute,
  '3rd set collapse': statsB.thirdSetCollapse,
  'BP cascade': statsB.bpCascade,
  'Lost bagel': statsB.lostBagel,
  '2nd serve pressure': statsB.secondServePressure
}).filter(([, v]) => v).map(([k]) => k).join(', ') || 'None'}
Signal score: ${scoreB}/100

--- HEAD TO HEAD ---
${h2h ? `Overall: ${playerA.name} ${h2h.player_a_id === playerAId ? h2h.player_a_wins : h2h.player_b_wins}-${h2h.player_a_id === playerAId ? h2h.player_b_wins : h2h.player_a_wins} ${playerB.name}
Clay: ${h2h.player_a_id === playerAId ? h2h.clay_a_wins : h2h.clay_b_wins}-${h2h.player_a_id === playerAId ? h2h.clay_b_wins : h2h.clay_a_wins} on clay
Analysis: ${h2h.h2h_narrative}` : 'No H2H data available'}

Provide three sections:
1. PLAYER A ASSESSMENT: One sentence on ${playerA.name}'s current performance state and risk level.
2. PLAYER B ASSESSMENT: One sentence on ${playerB.name}'s current performance state and risk level.
3. COMBINED VERDICT: Who has the edge right now, what to bet, and how long the market window is. Max 3 sentences. Be specific and direct.
    `;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await response.json();
      setPrediction(data.content[0].text);
    } catch (err) {
      setPrediction('Error generating prediction. Check your API key.');
    }

    setLoadingPrediction(false);
  }

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53935', fontSize: 15 }}>
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Dual Match Analysis</h2>
      </div>

      {/* Tournament input */}
      <select
  value={tournament}
  onChange={async e => {
    setTournament(e.target.value);
    const { data } = await supabase
      .from('tournament_profiles')
      .select('*')
      .ilike('tournament_name', `%${e.target.value}%`)
      .maybeSingle();
    setTournamentProfile(data || null);
  }}
  style={{
    width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #ddd',
    fontSize: 14, marginBottom: 8, boxSizing: 'border-box'
  }}
>
  <option value=''>Select tournament...</option>
  {tournamentOptions.map(t => (
    <option key={t.id} value={t.tournament_name}>
      {t.tournament_name} {t.year}
    </option>
  ))}
</select>

{tournamentProfile && (
  <div style={{
    padding: '10px 14px', borderRadius: 8, marginBottom: 12,
    background: '#e8f5e9', border: '1px solid #a5d6a7'
  }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32', marginBottom: 4 }}>
      ✅ {tournamentProfile.tournament_name} profile loaded
    </div>
    <div style={{ fontSize: 11, color: '#388e3c', lineHeight: 1.5 }}>
      {tournamentProfile.surface} · Speed {tournamentProfile.surface_speed} · {tournamentProfile.atp_level}
    </div>
    <div style={{ fontSize: 11, color: '#388e3c', lineHeight: 1.5, marginTop: 2 }}>
      {tournamentProfile.conditions_narrative}
    </div>
  </div>
)}
      {/* Player selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Player A</div>
          <select value={playerAId} onChange={e => setPlayerAId(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}>
            <option value=''>Select player...</option>
            {players.filter(p => p.id !== playerBId).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Player B</div>
          <select value={playerBId} onChange={e => setPlayerBId(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}>
            <option value=''>Select player...</option>
            {players.filter(p => p.id !== playerAId).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

{/* Reset button */}
{playerA && playerB && (
  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
    <button onClick={resetMatch}
      style={{ background: 'none', border: 'none', color: '#e53935', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
      Reset match
    </button>
  </div>
)}

{/* Score box */}
{playerA && playerB && (
  <div style={{ marginBottom: 16, background: '#f8f9fa', borderRadius: 10, padding: 14 }}>
    <div style={{ fontSize: 11, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10, fontSize: 11, color: '#888', textAlign: 'center', fontWeight: 600 }}>
      <div>{playerA.name}</div>
      <div>{playerB.name}</div>
    </div>
    {[['Sets', setsA, setSetsA, setsB, setSetsB, 3],
      ['Games', gamesA, setGamesA, gamesB, setGamesB, 7]].map(([label, a, setA, b, setB, max]) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8, justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: '#888', width: 50 }}>{label}</span>
        <button onClick={() => setA(Math.max(0, a-1))} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', background: 'white' }}>−</button>
        <span style={{ fontSize: 18, fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{a}</span>
        <button onClick={() => setA(Math.min(max, a+1))} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', background: 'white' }}>+</button>
        <span style={{ fontSize: 14, color: '#ccc' }}>—</span>
        <button onClick={() => setB(Math.max(0, b-1))} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', background: 'white' }}>−</button>
        <span style={{ fontSize: 18, fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{b}</span>
        <button onClick={() => setB(Math.min(max, b+1))} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer', background: 'white' }}>+</button>
      </div>
    ))}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#888', width: 50 }}>Points</span>
      {['0','15','30','40','AD'].map(p => (
        <button key={`a-${p}`} onClick={() => setPointsA(['0','15','30','40','AD'].indexOf(p))}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12,
            background: pointsA === ['0','15','30','40','AD'].indexOf(p) ? '#333' : 'white',
            color: pointsA === ['0','15','30','40','AD'].indexOf(p) ? 'white' : '#333' }}>
          {p}
        </button>
      ))}
      <span style={{ fontSize: 14, color: '#ccc' }}>—</span>
      {['0','15','30','40','AD'].map(p => (
        <button key={`b-${p}`} onClick={() => setPointsB(['0','15','30','40','AD'].indexOf(p))}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12,
            background: pointsB === ['0','15','30','40','AD'].indexOf(p) ? '#333' : 'white',
            color: pointsB === ['0','15','30','40','AD'].indexOf(p) ? 'white' : '#333' }}>
          {p}
        </button>
      ))}
    </div>
  </div>
)}
{/* Who serves first toggle */}
{playerA && playerB && (
  <div style={{ marginBottom: 12, background: '#f8f9fa', borderRadius: 10, padding: 12 }}>
    <div style={{ fontSize: 11, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Who served first?</div>
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => setWhoServesFirst('A')}
        style={{
          flex: 1, padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${whoServesFirst === 'A' ? '#e53935' : '#ddd'}`,
          background: whoServesFirst === 'A' ? '#ffebee' : 'white',
          color: whoServesFirst === 'A' ? '#e53935' : '#666'
        }}>
        {playerA.name}
      </button>
      <button onClick={() => setWhoServesFirst('B')}
        style={{
          flex: 1, padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${whoServesFirst === 'B' ? '#e53935' : '#ddd'}`,
          background: whoServesFirst === 'B' ? '#ffebee' : 'white',
          color: whoServesFirst === 'B' ? '#e53935' : '#666'
        }}>
        {playerB.name}
      </button>
    </div>
  </div>
)}

{/* Break History */}
{playerA && playerB && breakHistory.length > 0 && (
  <div style={{ marginBottom: 16, background: '#fff3e0', borderRadius: 10, padding: 12, border: '1px solid #ffcc80' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#e65100', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
        Break History ({breakHistory.length} total)
      </div>
      <button
        onClick={() => {
          setBreakHistory([]);
          setPrevGames({ a: gamesA, b: gamesB, set: setsA + setsB + 1 });
        }}
        style={{ background: 'none', border: 'none', color: '#e65100', fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
        Reset breaks
      </button>
    </div>
    {breakHistory.map((b, i) => (
      <div key={i} style={{ fontSize: 12, color: '#5d4037', marginBottom: 4 }}>
        Set {b.set} · Game {b.gameNumber} · <strong>{b.brokenPlayer === 'A' ? playerA.name : playerB.name}</strong> broken at {b.score}
      </div>
    ))}
  </div>
)}
{/* Match context */}
{playerA && playerB && (
  <textarea
    placeholder="Match context (e.g. tournament situation, recent form, weather, anything notable)"
    value={matchContext}
    onChange={e => setMatchContext(e.target.value)}
    rows={3}
    style={{
      width: '100%', marginBottom: 16, fontSize: 13, padding: 10,
      borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box', resize: 'none'
    }}
  />
)}

{/* Live match connect button */}
{!liveConnected && playerA && playerB && (
  <div style={{
    padding: '10px 14px', borderRadius: 8, marginBottom: 12,
    background: '#fff3e0', border: '1px solid #ffcc80'
  }}>
    <div style={{ fontSize: 12, color: '#e65100', marginBottom: 8 }}>
      No live data connected. Enter match ID from SofaScore to auto-track.
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        placeholder="SofaScore match ID (e.g. 12345678)"
        style={{
          flex: 1, padding: '8px 12px', borderRadius: 6,
          border: '1px solid #ddd', fontSize: 13
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') setLiveMatchId(e.target.value.trim());
        }}
      />
      <button
        onClick={e => {
          const input = e.target.previousSibling;
          if (input.value) setLiveMatchId(input.value.trim());
        }}
        style={{
          padding: '8px 16px', borderRadius: 6, background: '#e53935',
          color: 'white', border: 'none', fontSize: 12,
          fontWeight: 600, cursor: 'pointer'
        }}>
        Connect
      </button>
    </div>
  </div>
)}
{/* Live connection bar */}
{liveConnected && (
  <div style={{
    padding: '10px 14px', borderRadius: 8, marginBottom: 12,
    background: '#e8f5e9', border: '1px solid #a5d6a7',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>
      ● Live data connected — auto-updating every 30s
    </div>
    <div style={{ fontSize: 11, color: '#388e3c' }}>
      {lastUpdated ? `Last: ${new Date(lastUpdated).toLocaleTimeString()}` : ''}
    </div>
  </div>
)}

{/* Pre-match research bar */}
{prematchResearch && playerA && playerB && (
  <div style={{
    padding: '12px 14px', borderRadius: 10, marginBottom: 12,
    background: '#f3e5f5', border: '1px solid #ce93d8'
  }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: '#7b1fa2', marginBottom: 6 }}>
      📊 Pre-match research loaded
    </div>
    <div style={{ fontSize: 11, color: '#6a1b9a', lineHeight: 1.5, marginBottom: 4 }}>
      <strong>Verdict:</strong> {prematchResearch.model_verdict}
    </div>
    <div style={{ fontSize: 11, color: '#6a1b9a', lineHeight: 1.5, marginBottom: 4 }}>
      <strong>Primary bet:</strong> {prematchResearch.primary_bet} ({prematchResearch.primary_ev_pct}% EV)
    </div>
    {prematchResearch.market_error_pp && (
      <div style={{ fontSize: 11, color: '#6a1b9a', lineHeight: 1.5 }}>
        <strong>Market error:</strong> {prematchResearch.market_error_pp}pp gap
      </div>
    )}
  </div>
)}
      {/* H2H summary bar */}
      {h2h && playerA && playerB && (
        <div style={{
          padding: '14px 16px', borderRadius: 10, background: '#1a1a2e',
          color: 'white', marginBottom: 20
        }}>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>HEAD TO HEAD</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700 }}>{playerA.name}</span>
            <span style={{ fontSize: 20, fontWeight: 800 }}>
              {h2h.player_a_id === playerAId ? h2h.player_a_wins : h2h.player_b_wins}
              {' — '}
              {h2h.player_a_id === playerAId ? h2h.player_b_wins : h2h.player_a_wins}
            </span>
            <span style={{ fontWeight: 700 }}>{playerB.name}</span>
          </div>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>
            Clay: {h2h.player_a_id === playerAId ? h2h.clay_a_wins : h2h.clay_b_wins}
            {' — '}
            {h2h.player_a_id === playerAId ? h2h.clay_b_wins : h2h.clay_a_wins}
          </div>
          {h2h.h2h_narrative && (
            <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5 }}>{h2h.h2h_narrative}</div>
          )}
        </div>
      )}

      {/* No H2H data notice */}
      {playerA && playerB && !h2h && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, background: '#fff3e0',
          color: '#e65100', fontSize: 13, marginBottom: 20
        }}>
          No H2H data found for this matchup. Upload research first for a stronger prediction.
        </div>
      )}

      {/* Dual panels */}
      {playerA && playerB && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
            <PlayerPanel
              player={playerA} thresholds={thresholdsA}
              stats={statsA} onChange={setStatsA} side="A"
            />
            <PlayerPanel
              player={playerB} thresholds={thresholdsB}
              stats={statsB} onChange={setStatsB} side="B"
            />
          </div>

          {/* Get prediction button */}
          <button
            onClick={getDualPrediction}
            disabled={loadingPrediction}
            style={{
              width: '100%', padding: '16px', borderRadius: 10,
              background: loadingPrediction ? '#ccc' : '#e53935',
              color: 'white', border: 'none', fontSize: 16,
              fontWeight: 700, cursor: loadingPrediction ? 'not-allowed' : 'pointer',
              marginBottom: 16
            }}
          >
            {loadingPrediction ? 'Analysing both players...' : 'Get Dual Prediction'}
          </button>

          {/* Prediction output */}
          {prediction && (
            <div style={{
              padding: '16px', borderRadius: 10, border: '1px solid #e53935',
              background: '#fff', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap'
            }}>
              <div style={{ fontSize: 12, color: '#e53935', fontWeight: 700, marginBottom: 8 }}>
                DUAL ANALYSIS
              </div>
              {prediction}
            </div>
          )}
        </>
      )}
    </div>
  );
}