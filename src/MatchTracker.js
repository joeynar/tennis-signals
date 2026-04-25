import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

function MatchTracker({ player, onBack }) {
  const [thresholds, setThresholds] = useState(null);
  const [servePct, setServePct] = useState(65);
  const [doubleFaults, setDoubleFaults] = useState(0);
  const [bpMissed, setBpMissed] = useState(0);
  const [consecutivePoints, setConsecutivePoints] = useState(0);
  const [setContext, setSetContext] = useState(1);
  const [situation, setSituation] = useState(1);
  const [flags, setFlags] = useState({
    bodyLanguage: false,
    umpireDispute: false,
    thirdSetCollapse: false,
    bpCascade: false,
    lostFirstSetBagel: false
  });
  const [score, setScore] = useState(0);
  const [alertLevel, setAlertLevel] = useState('none');
  const [prediction, setPrediction] = useState('');
  const [opponent, setOpponent] = useState('');
  const [tournament, setTournament] = useState('');
  const [setsPlayer, setSetsPlayer] = useState(0);
const [setsOpponent, setSetsOpponent] = useState(0);
const [gamesPlayer, setGamesPlayer] = useState(0);
const [gamesOpponent, setGamesOpponent] = useState(0);
const [pointsPlayer, setPointsPlayer] = useState(0);
const [pointsOpponent, setPointsOpponent] = useState(0);
const [matchContext, setMatchContext] = useState('');
  const [set1ServePct, setSet1ServePct] = useState(65);
const [set2ServePct, setSet2ServePct] = useState(65);
const [gamesLostRow, setGamesLostRow] = useState(0);
const [secondServePressure, setSecondServePressure] = useState(false);
const [unforcedErrors, setUnforcedErrors] = useState(0);
const [winners, setWinners] = useState(0);
const [secondServeWonPct, setSecondServeWonPct] = useState(50);
const [serviceHoldPct, setServiceHoldPct] = useState(75);
const [aces, setAces] = useState(0);
const [avgRallyLength, setAvgRallyLength] = useState(4);
const [firstServeSpeed, setFirstServeSpeed] = useState(180);
const [bpCreated, setBpCreated] = useState(0);
const [tournamentOptions, setTournamentOptions] = useState([]);
const [tournamentProfile, setTournamentProfile] = useState(null);
const [prematchResearch, setPrematchResearch] = useState(null);
const [liveMatchId, setLiveMatchId] = useState(null);
const [liveConnected, setLiveConnected] = useState(false);
const [lastUpdated, setLastUpdated] = useState(null);
const [opponentProfile, setOpponentProfile] = useState(null);
const [whoServesFirst, setWhoServesFirst] = useState('player'); // 'player' or 'opponent'
const [breakHistory, setBreakHistory] = useState([]); // array of {set, gameNumber, brokenPlayer, score}
const [prevGames, setPrevGames] = useState({ player: 0, opponent: 0, set: 1 });


  useEffect(() => {
    fetchThresholds();
  }, [player]);
  useEffect(() => {
    supabase
      .from('tournament_profiles')
      .select('id, tournament_name, year')
      .order('tournament_name')
      .then(({ data }) => { if (data) setTournamentOptions(data); });
  }, []);

  useEffect(() => {
    calculateScore();
  }, [servePct, doubleFaults, bpMissed, consecutivePoints, setContext, situation, flags, thresholds, set1ServePct, set2ServePct, gamesLostRow, secondServePressure, unforcedErrors, winners, secondServeWonPct, serviceHoldPct, aces, avgRallyLength, firstServeSpeed, bpCreated]);

  useEffect(() => {
    // Detect breaks when games change
    const currentSet = setContext === 1 ? 1 : setContext === 1.3 ? 2 : 3;
    
    // If we changed sets, reset prevGames for new set
    if (currentSet !== prevGames.set) {
      setPrevGames({ player: gamesPlayer, opponent: gamesOpponent, set: currentSet });
      return;
    }
    
    // Detect if a break just happened
    const playerGameUp = gamesPlayer > prevGames.player;
    const opponentGameUp = gamesOpponent > prevGames.opponent;
    
    if (playerGameUp || opponentGameUp) {
      const totalGamesBefore = prevGames.player + prevGames.opponent;
      const gameNumber = totalGamesBefore + 1;
      
      // Determine who was serving this game
      // If player serves first: player serves odd games (1, 3, 5...), opponent serves even (2, 4, 6...)
      // If opponent serves first: opposite
      const playerServesThisGame = whoServesFirst === 'player' 
        ? gameNumber % 2 === 1 
        : gameNumber % 2 === 0;
      
      // Break detected if non-server won the game
      if (playerGameUp && !playerServesThisGame) {
        // Player won opponent's serve — opponent got broken
        setBreakHistory(prev => [...prev, {
          set: currentSet,
          gameNumber: gameNumber,
          brokenPlayer: 'opponent',
          score: `${gamesPlayer}-${gamesOpponent}`,
          timestamp: new Date().toISOString()
        }]);
      } else if (opponentGameUp && playerServesThisGame) {
        // Opponent won player's serve — player got broken
        setBreakHistory(prev => [...prev, {
          set: currentSet,
          gameNumber: gameNumber,
          brokenPlayer: 'player',
          score: `${gamesPlayer}-${gamesOpponent}`,
          timestamp: new Date().toISOString()
        }]);
      }
      
      setPrevGames({ player: gamesPlayer, opponent: gamesOpponent, set: currentSet });
    }
  }, [gamesPlayer, gamesOpponent, setContext]);

  async function fetchThresholds() {
    const { data } = await supabase
      .from('signal_thresholds')
      .select('*')
      .eq('player_id', player.id)
      .eq('surface', 'clay')
      .single();
    if (data) setThresholds(data);
  }
  // Real-time listener for live match data
useEffect(() => {
  if (!liveMatchId) return;

  const subscription = supabase
    .channel('live-match-single')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'live_match',
      filter: `match_id=eq.${liveMatchId}`
    }, (payload) => {
      const data = payload.new;
      if (!data) return;

      // Update score
      setSetsPlayer(data.sets_a || 0);
      setSetsOpponent(data.sets_b || 0);
      setGamesPlayer(data.games_a || 0);
      setGamesOpponent(data.games_b || 0);

      // Update sliders from live data
      if (data.a_first_serve_pct) setServePct(data.a_first_serve_pct);
      if (data.a_double_faults !== undefined) setDoubleFaults(data.a_double_faults);
      if (data.a_aces !== undefined) setAces(data.a_aces);
      if (data.a_winners !== undefined) setWinners(data.a_winners);
      if (data.a_unforced_errors !== undefined) setUnforcedErrors(data.a_unforced_errors);
      if (data.a_bp_faced !== undefined) {
        setBpMissed(data.a_bp_faced - (data.a_bp_won || 0));
        setBpCreated(data.a_bp_faced);
      }
      if (data.a_second_serve_won_pct) setSecondServeWonPct(data.a_second_serve_won_pct);
      if (data.a_service_games_played > 0) {
        setServiceHoldPct(Math.round((data.a_service_games_won / data.a_service_games_played) * 100));
      }

      setLastUpdated(new Date().toISOString());
      setLiveConnected(true);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}, [liveMatchId]);
  async function fetchTournamentProfile(name) {
    if (!name || name.length < 3) return;
    const { data } = await supabase
      .from('tournament_profiles')
      .select('*')
      .ilike('tournament_name', `%${name}%`)
      .maybeSingle();
    if (data) setTournamentProfile(data);
    else setTournamentProfile(null);
  }
  async function fetchPrematchResearch(opponentName) {
    if (!opponentName || opponentName.length < 3 || !player?.id) return;
    
    // Find opponent in players table first
    const { data: opp } = await supabase
      .from('players')
      .select('id')
      .ilike('name', `%${opponentName}%`)
      .maybeSingle();
    
    if (!opp) {
      setPrematchResearch(null);
      return;
    }
    
    // Look for pre-match research between these two players (today or recent)
    const { data } = await supabase
      .from('prematch_research')
      .select('*')
      .or(
        `and(player_a_id.eq.${player.id},player_b_id.eq.${opp.id}),` +
        `and(player_a_id.eq.${opp.id},player_b_id.eq.${player.id})`
      )
      .order('match_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    setPrematchResearch(data || null);
  }
  async function fetchOpponentProfile(name) {
    if (!name || name.length < 3) return;
    const { data } = await supabase
      .from('players')
      .select('*')
      .ilike('name', `%${name}%`)
      .single();
    if (data) setOpponentProfile(data);
    else setOpponentProfile(null);
  }

  function toggleFlag(key) {
    setFlags(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function calculateScore() {
    if (!thresholds) return;

    let serveScore = 0;
    const drop = thresholds.serve_baseline - servePct;
    if (servePct <= thresholds.signal_threshold) serveScore = 30;
    else if (servePct <= thresholds.warn_threshold) serveScore = 15;
    else if (drop > 3) serveScore = 5;

    let dfScore = 0;
    if (doubleFaults >= 3) dfScore = 20;
    else if (doubleFaults >= 2) dfScore = 10;
    else if (doubleFaults >= 1) dfScore = 3;

    let moScore = 0;
    if (consecutivePoints >= 6) moScore = 20;
    else if (consecutivePoints >= 4) moScore = 12;
    else if (consecutivePoints >= 3) moScore = 5;

    let bpScore = 0;
    if (bpMissed >= 5) bpScore = 20;
    else if (bpMissed >= 3) bpScore = 10;
    else if (bpMissed >= 2) bpScore = 4;

    let trendScore = 0;
const currentSet = setContext === 1.8 ? 3 : setContext === 1.3 ? 2 : 1;
if (currentSet === 2 && set1ServePct > 0) {
  const drop = set1ServePct - servePct;
  if (drop >= 15) trendScore = 25;
  else if (drop >= 10) trendScore = 15;
  else if (drop >= 5) trendScore = 8;
}
if (currentSet === 3 && set2ServePct > 0) {
  const drop = set2ServePct - servePct;
  if (drop >= 15) trendScore = 30;
  else if (drop >= 10) trendScore = 18;
  else if (drop >= 5) trendScore = 10;
}
let gamesScore = 0;
if (gamesLostRow >= 4) gamesScore = 20;
else if (gamesLostRow >= 3) gamesScore = 12;
else if (gamesLostRow >= 2) gamesScore = 5;
if (secondServePressure) gamesScore += 12;

// Winner-to-error ratio score (very predictive)
let werScore = 0;
const wer = winners / Math.max(unforcedErrors, 1);
if (wer < 0.5) werScore = 18;        // disastrous
else if (wer < 0.8) werScore = 12;   // struggling
else if (wer < 1.0) werScore = 6;    // borderline

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
    
// Pressure efficiency — earned BPs vs missed
let pressureScore = 0;
if (bpCreated >= 5 && bpMissed >= 4) pressureScore = 12;  // creating but failing
else if (bpCreated >= 3 && bpMissed >= 3) pressureScore = 6;

// Rally length mismatch (long rallies = grinder mode = exhaustion risk for power players)
let rallyScore = 0;
if (avgRallyLength >= 7) rallyScore = 8;
else if (avgRallyLength >= 5) rallyScore = 4;

// Serve speed drop
let speedScore = 0;
if (firstServeSpeed <= 160) speedScore = 10;
else if (firstServeSpeed <= 170) speedScore = 5;
let flagScore = 0;
    if (flags.bodyLanguage) flagScore += 8;
    if (flags.umpireDispute) flagScore += 15;
    if (flags.thirdSetCollapse) flagScore += 18;
    if (flags.bpCascade) flagScore += 10;
    if (flags.lostFirstSetBagel) flagScore += 12;

    const raw = serveScore + dfScore + moScore + bpScore + trendScore + gamesScore + werScore + s2Score + holdScore + pressureScore + rallyScore + speedScore;
    const total = Math.min(100, Math.round(raw * setContext * situation * 0.6 + flagScore));

    setScore(total);

    if (total >= 75) {
        if (alertLevel !== 'high') { 
            saveSignal(total, 'high'); 
            getPrediction(); 
            sendTelegram(`🚨 HIGH CONFIDENCE SIGNAL\n\nPlayer: ${player.name}\nOpponent: ${opponent || 'Unknown'}\nScore: ${total}/100\nFirst serve: ${servePct}%\nDouble faults: ${doubleFaults}\nBP missed: ${bpMissed}\n\nBet opponent now. Market window: 15-30 seconds.`);
          }
      setAlertLevel('high');
    } else if (total >= 60) {
      if (alertLevel !== 'medium' && alertLevel !== 'high') saveSignal(total, 'medium');
      setAlertLevel('medium');
    } else if (total >= 35) {
      setAlertLevel('watch');
    } else {
      setAlertLevel('none');
    }
  }

  async function saveSignal(score, level) {
    if (!player || !player.id) return;
    
    const { error } = await supabase
      .from('signal_log')
      .insert({
        player_id: player.id,
        match_date: new Date().toISOString().split('T')[0],
        tournament: 'Live Match',
        opponent: opponent || 'Unknown',
        fired_at: new Date().toISOString(),
        signal_score: score,
        signal_type: flags.thirdSetCollapse || flags.umpireDispute ? 'short' : 'medium',
        triggers_active: flags,
        serve_pct_at_fire: servePct,
        double_faults_at_fire: doubleFaults,
        bp_missed_at_fire: bpMissed,
        set_context: setContext === 1 ? '1st set' : setContext === 1.3 ? '2nd set' : '3rd set',
      });
  
    if (error) {
      console.error('Signal save error:', error);
    }
  }
  async function getPrediction() {
    try {
      const { data: stats } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', player.id)
        .order('match_date', { ascending: false })
        .limit(10);
  
      const { data: thresh } = await supabase
        .from('signal_thresholds')
        .select('*')
        .eq('player_id', player.id)
        .single();
  
      const prompt = `You are an expert tennis betting analyst. Analyze this live match situation and give a specific outcome prediction.
  
  PLAYER: ${player.name} (${player.nationality}, ranked #${player.ranking}, ${player.hand}-handed)
  KNOWN COLLAPSE TRIGGERS: ${JSON.stringify(player.collapse_triggers)}
  
  LAST 10 MATCHES ON CLAY:
  ${stats ? stats.map(s => `vs ${s.opponent}: ${s.result} ${s.score} | 1st serve: ${s.first_serve_pct}% | DFs: ${s.double_faults} | BP conv: ${s.bp_converted_pct}%`).join('\n') : 'No data'}
  
  SIGNAL THRESHOLDS:
  Baseline first serve: ${thresh ? thresh.serve_baseline : 'N/A'}%
  Signal threshold: ${thresh ? thresh.signal_threshold : 'N/A'}%
  
  CURRENT MATCH STATE:
  - Opponent: ${opponent || 'Unknown'}
- Tournament: ${tournament || 'Unknown'}
- Current score: Sets ${setsPlayer}-${setsOpponent} | Games ${gamesPlayer}-${gamesOpponent} | Points ${['0','15','30','40','AD'][pointsPlayer]}-${['0','15','30','40','AD'][pointsOpponent]}
- Tournament profile: ${tournamentProfile ? `Surface speed: ${tournamentProfile.surface_speed} | ${tournamentProfile.conditions_narrative} | Upgrade: ${tournamentProfile.upgrade_profile} | Downgrade: ${tournamentProfile.downgrade_profile} | Live triggers: ${tournamentProfile.live_triggers} | Weather: ${tournamentProfile.weather_overlay}` : 'No tournament profile loaded'}
- PRE-MATCH RESEARCH: ${prematchResearch ? `MODEL VERDICT: ${prematchResearch.model_verdict}. Model probability: ${player.name} ${prematchResearch.model_prob_a ? Math.round(prematchResearch.model_prob_a * 100) : '?'}% vs Market ${prematchResearch.market_prob_a ? Math.round(prematchResearch.market_prob_a * 100) : '?'}% (${prematchResearch.market_error_pp}pp error). Primary bet: ${prematchResearch.primary_bet}. Live triggers to watch: ${prematchResearch.live_triggers}. Form summary - ${player.name}: ${prematchResearch.player_a_form_summary}. Opponent form: ${prematchResearch.player_b_form_summary}` : 'No pre-match research loaded'}
- Opponent profile: ${opponentProfile ? `${opponentProfile.name} (ranked ${opponentProfile.ranking}) — ${opponentProfile.style_notes}. Collapse triggers: ${JSON.stringify(opponentProfile.collapse_triggers)}` : 'Not in database'}
  - Current first serve %: ${servePct}% (${thresh ? (servePct < thresh.signal_threshold ? 'BELOW SIGNAL THRESHOLD' : servePct < thresh.warn_threshold ? 'IN WATCH ZONE' : 'NORMAL') : ''})
  - Double faults this set: ${doubleFaults}
  - Break points missed: ${bpMissed}
  - Consecutive points lost: ${consecutivePoints}
  - Unforced errors this set: ${unforcedErrors}
- Winners this set: ${winners} (W/E ratio: ${(winners / Math.max(unforcedErrors, 1)).toFixed(2)})
- 2nd serve points won: ${secondServeWonPct}%
- Service hold % this match: ${serviceHoldPct}%
- Aces this set: ${aces}
- Average rally length: ${avgRallyLength} shots
- First serve speed avg: ${firstServeSpeed} km/h
- Break points created this set: ${bpCreated} (converted: ${Math.max(0, bpCreated - bpMissed)})
  - Set: ${setContext === 1 ? '1st' : setContext === 1.3 ? '2nd' : '3rd'}
  - Situation: ${situation === 2 ? 'Serving for set/match or tiebreak' : situation === 1.5 ? 'Leading but opponent broke back' : situation === 1.3 ? 'Serving to stay in set' : 'Normal game'}
  - Active flags: ${Object.entries(flags).filter(([k,v]) => v).map(([k]) => k).join(', ') || 'None'}
  - BREAK HISTORY: ${getBreakSummary() ? `Total breaks: ${getBreakSummary().total}. ${player.name} got broken at: ${getBreakSummary().playerBrokenAt || 'none'}. ${opponent || 'Opponent'} got broken at: ${getBreakSummary().opponentBrokenAt || 'none'}. Current set breaks: ${getBreakSummary().currentSet}` : 'No breaks yet'}
  - Signal score: ${score}/100
  
  Based on this data, provide:
  1. The most likely outcome in the next 1-3 games (be specific)
  2. Probability estimate (e.g. 65%)
  3. What to bet on right now
  4. How long the market window likely is
  
  Be direct and specific. Max 4 sentences.`;
  
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
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }]
        })
      });
  
      const data = await response.json();
      console.log('API response:', data);
      if (data.content && data.content[0]) {
        setPrediction(data.content[0].text);
      }
    } catch (err) {
      console.error('Prediction error:', err);
      setPrediction('Prediction unavailable right now.');
    }
  }
  async function sendTelegram(message) {
  const botToken = '8734171567:AAHKUWJEXN6gq3OVrzmIRgkpQGZ7oudl5iM';
  const chatId = '6013101232';
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    })
  });
}
function getBreakSummary() {
  if (breakHistory.length === 0) return null;
  
  const playerBreaks = breakHistory.filter(b => b.brokenPlayer === 'player');
  const opponentBreaks = breakHistory.filter(b => b.brokenPlayer === 'opponent');
  const currentSet = setContext === 1 ? 1 : setContext === 1.3 ? 2 : 3;
  const currentSetBreaks = breakHistory.filter(b => b.set === currentSet);
  
  return {
    total: breakHistory.length,
    playerBreaks: playerBreaks.length,
    opponentBreaks: opponentBreaks.length,
    currentSet: currentSetBreaks.length,
    history: breakHistory,
    playerBrokenAt: playerBreaks.map(b => `Set ${b.set} game ${b.gameNumber} (${b.score})`).join(', '),
    opponentBrokenAt: opponentBreaks.map(b => `Set ${b.set} game ${b.gameNumber} (${b.score})`).join(', ')
  };
}
  function getAlertColor() {
    if (alertLevel === 'high') return '#E24B4A';
    if (alertLevel === 'medium') return '#BA7517';
    if (alertLevel === 'watch') return '#639922';
    return '#888';
  }

  function getAlertText() {
    if (alertLevel === 'high') return 'HIGH CONFIDENCE — Act now';
    if (alertLevel === 'medium') return 'SIGNAL CONFIRMED — Check odds';
    if (alertLevel === 'watch') return 'WATCH — Pattern building';
    return 'No signal — Monitor passively';
  }

  function getOutcome() {
    if (alertLevel === 'high') return 'Opponent wins set or match momentum fully shifts. Bet opponent now.';
    if (alertLevel === 'medium') return 'Opponent likely breaks next game or set swings. Check odds movement.';
    if (alertLevel === 'watch') return 'Pattern emerging. Wait for one more confirming signal before acting.';
    return 'Nothing actionable yet.';
  }

  const inputStyle = {
    width: '100%',
    margin: '6px 0 12px',
    accentColor: getAlertColor()
  };

  const labelStyle = {
    fontSize: '12px',
    color: '#888',
    display: 'block',
    marginBottom: '2px'
  };

  const flagStyle = (active, danger) => ({
    padding: '8px 12px',
    fontSize: '12px',
    borderRadius: '8px',
    border: `1px solid ${active ? (danger ? '#E24B4A' : '#BA7517') : '#ddd'}`,
    background: active ? (danger ? '#fff0f0' : '#fffbe6') : 'white',
    color: active ? (danger ? '#E24B4A' : '#BA7517') : '#444',
    cursor: 'pointer',
    flex: 1,
    textAlign: 'center'
  });

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>
      
      <button onClick={onBack} style={{ fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px' }}>
        ← Back
      </button>
      <button onClick={() => {
  setServePct(65);
  setDoubleFaults(0);
  setBpMissed(0);
  setConsecutivePoints(0);
  setSetContext(1);
  setSituation(1);
  setFlags({ bodyLanguage: false, umpireDispute: false, thirdSetCollapse: false, bpCascade: false, lostFirstSetBagel: false });
  setScore(0);
  setAlertLevel('none');
  setPrediction('');
  setSet1ServePct(65);
setSet2ServePct(65);
setGamesLostRow(0);
setUnforcedErrors(0);
setWinners(0);
setSecondServeWonPct(50);
setServiceHoldPct(75);
setAces(0);
setAvgRallyLength(4);
setFirstServeSpeed(180);
setBpCreated(0);
setTournament('');
setSetsPlayer(0);
setSetsOpponent(0);
setGamesPlayer(0);
setGamesOpponent(0);
setPointsPlayer(0);
setPointsOpponent(0);
setMatchContext('');
setBreakHistory([]);
setPrevGames({ player: 0, opponent: 0, set: 1 });
}} style={{ fontSize: '12px', color: '#E24B4A', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', marginLeft: '12px' }}>
  Reset match
</button>
      <input 
  type="text"
  placeholder="Opponent name"
  value={opponent}
  onChange={e => { setOpponent(e.target.value); fetchOpponentProfile(e.target.value); fetchPrematchResearch(e.target.value); }}
  style={{ width: '100%', marginBottom: '12px', fontSize: '13px', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
/>
<select
  value={tournament}
  onChange={e => {
    setTournament(e.target.value);
    fetchTournamentProfile(e.target.value);
  }}
  style={{ width: '100%', marginBottom: '8px', fontSize: '13px', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
>
  <option value=''>Select tournament...</option>
  {tournamentOptions.map(t => (
    <option key={t.id} value={t.tournament_name}>
      {t.tournament_name} {t.year}
    </option>
  ))}
</select>
<div style={{ marginBottom: '12px', background: '#f8f9fa', borderRadius: '10px', padding: '12px' }}>
  <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</div>
  
  {[['Sets', setsPlayer, setSetsPlayer, setsOpponent, setSetsOpponent, 3],
    ['Games', gamesPlayer, setGamesPlayer, gamesOpponent, setGamesOpponent, 7]].map(([label, p, setP, o, setO, max]) => (
    <div key={label} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
      <span style={{ fontSize: '12px', color: '#888', width: '45px' }}>{label}</span>
      <button onClick={() => setP(Math.max(0, p-1))} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer', background: 'white' }}>−</button>
      <span style={{ fontSize: '18px', fontWeight: '600', minWidth: '16px', textAlign: 'center' }}>{p}</span>
      <span style={{ fontSize: '14px', color: '#ccc' }}>—</span>
      <span style={{ fontSize: '18px', fontWeight: '600', minWidth: '16px', textAlign: 'center' }}>{o}</span>
      <button onClick={() => setO(Math.max(0, o-1))} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer', background: 'white' }}>−</button>
      <button onClick={() => setO(Math.min(max, o+1))} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer', background: 'white' }}>+</button>
      <button onClick={() => setP(Math.min(max, p+1))} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer', background: 'white' }}>+</button>
    </div>
  ))}

  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <span style={{ fontSize: '12px', color: '#888', width: '45px' }}>Points</span>
    {['0','15','30','40','AD'].map(p => (
      <button key={p} onClick={() => setPointsPlayer(['0','15','30','40','AD'].indexOf(p))}
        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer', fontSize: '12px', background: pointsPlayer === ['0','15','30','40','AD'].indexOf(p) ? '#333' : 'white', color: pointsPlayer === ['0','15','30','40','AD'].indexOf(p) ? 'white' : '#333' }}>
        {p}
      </button>
    ))}
    <span style={{ fontSize: '14px', color: '#ccc' }}>—</span>
    {['0','15','30','40','AD'].map(p => (
      <button key={p} onClick={() => setPointsOpponent(['0','15','30','40','AD'].indexOf(p))}
        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer', fontSize: '12px', background: pointsOpponent === ['0','15','30','40','AD'].indexOf(p) ? '#333' : 'white', color: pointsOpponent === ['0','15','30','40','AD'].indexOf(p) ? 'white' : '#333' }}>
        {p}
      </button>
    ))}
  </div>
</div>
{prematchResearch && (
  <div style={{
    padding: '12px 14px', borderRadius: 8, marginBottom: 12,
    background: '#f3e5f5', border: '1px solid #ce93d8'
  }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: '#7b1fa2', marginBottom: 6 }}>
      📊 Pre-match research loaded
    </div>
    <div style={{ fontSize: 11, color: '#6a1b9a', lineHeight: 1.5 }}>
      <strong>Verdict:</strong> {prematchResearch.model_verdict}
    </div>
    <div style={{ fontSize: 11, color: '#6a1b9a', lineHeight: 1.5, marginTop: 4 }}>
      <strong>Primary bet:</strong> {prematchResearch.primary_bet} ({prematchResearch.primary_ev_pct}% EV)
    </div>
    {prematchResearch.market_error_pp && (
      <div style={{ fontSize: 11, color: '#6a1b9a', lineHeight: 1.5, marginTop: 4 }}>
        <strong>Market error:</strong> {prematchResearch.market_error_pp}pp gap detected
      </div>
    )}
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

{!liveConnected && (
  <div style={{
    padding: '10px 14px', borderRadius: 8, marginBottom: 12,
    background: '#fff3e0', border: '1px solid #ffcc80'
  }}>
    <div style={{ fontSize: 12, color: '#e65100', marginBottom: 8 }}>
      No live data connected. Enter SofaScore match ID to auto-track.
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        placeholder="SofaScore match ID (e.g. 12345678)"
        style={{
          flex: 1, padding: '8px 12px', borderRadius: 6,
          border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box'
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
<textarea
  placeholder="Match context (e.g. Hurkacz back from knee surgery, won vs Darderi and Marozsan. Vacherot beat Musetti R2 at home crowd)"
  value={matchContext}
  onChange={e => setMatchContext(e.target.value)}
  rows={3}
  style={{ width: '100%', marginBottom: '12px', fontSize: '13px', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', resize: 'none' }}
/>
{/* Who serves first toggle */}
<div style={{ marginBottom: 12, background: '#f8f9fa', borderRadius: 10, padding: 12 }}>
  <div style={{ fontSize: 11, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Who served first?</div>
  <div style={{ display: 'flex', gap: 8 }}>
    <button onClick={() => setWhoServesFirst('player')}
      style={{
        flex: 1, padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${whoServesFirst === 'player' ? '#e53935' : '#ddd'}`,
        background: whoServesFirst === 'player' ? '#ffebee' : 'white',
        color: whoServesFirst === 'player' ? '#e53935' : '#666'
      }}>
      {player.name}
    </button>
    <button onClick={() => setWhoServesFirst('opponent')}
      style={{
        flex: 1, padding: '8px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${whoServesFirst === 'opponent' ? '#e53935' : '#ddd'}`,
        background: whoServesFirst === 'opponent' ? '#ffebee' : 'white',
        color: whoServesFirst === 'opponent' ? '#e53935' : '#666'
      }}>
      {opponent || 'Opponent'}
    </button>
  </div>
</div>

{/* Break History */}
{breakHistory.length > 0 && (
  <div style={{ marginBottom: 16, background: '#fff3e0', borderRadius: 10, padding: 12, border: '1px solid #ffcc80' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
  <div style={{ fontSize: 11, color: '#e65100', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
    Break History ({breakHistory.length} total)
  </div>
  <button
    onClick={() => {
      setBreakHistory([]);
      setPrevGames({ player: gamesPlayer, opponent: gamesOpponent, set: setContext === 1 ? 1 : setContext === 1.3 ? 2 : 3 });
    }}
    style={{ background: 'none', border: 'none', color: '#e65100', fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
    Reset breaks
  </button>
</div>
    {breakHistory.map((b, i) => (
      <div key={i} style={{ fontSize: 12, color: '#5d4037', marginBottom: 4 }}>
        Set {b.set} · Game {b.gameNumber} · <strong>{b.brokenPlayer === 'player' ? player.name : (opponent || 'Opponent')}</strong> broken at {b.score}
      </div>
    ))}
  </div>
)}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: '500' }}>{player.name}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>Live match tracker · Clay</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '32px', fontWeight: '500', color: getAlertColor() }}>{score}</div>
          <div style={{ fontSize: '10px', color: '#888' }}>signal score</div>
        </div>
      </div>

      <div style={{ padding: '14px', borderRadius: '10px', background: getAlertColor(), marginBottom: '20px' }}>
        <div style={{ color: 'white', fontWeight: '500', fontSize: '13px' }}>{getAlertText()}</div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', marginTop: '4px' }}>{getOutcome()}</div>
      </div>
      {prediction && (
  <div style={{ padding: '14px', borderRadius: '10px', background: '#f8f9fa', border: '1px solid #e9ecef', marginBottom: '20px' }}>
    <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Prediction</div>
    <div style={{ fontSize: '13px', color: '#333', lineHeight: '1.6' }}>{prediction}</div>
  </div>
)}

<div style={{ marginBottom: '16px' }}>
  <span style={labelStyle}>Set 1 first serve % (for trend tracking)</span>
  <input type="range" min="30" max="90" value={set1ServePct} onChange={e => setSet1ServePct(+e.target.value)} style={inputStyle} />
  <div style={{ fontSize: '14px', fontWeight: '500' }}>{set1ServePct}%</div>
</div>

<div style={{ marginBottom: '16px' }}>
  <span style={labelStyle}>Set 2 first serve % (for trend tracking)</span>
  <input type="range" min="30" max="90" value={set2ServePct} onChange={e => setSet2ServePct(+e.target.value)} style={inputStyle} />
  <div style={{ fontSize: '14px', fontWeight: '500' }}>{set2ServePct}%</div>
</div>

<div style={{ marginBottom: '16px' }}>
  <span style={labelStyle}>Games lost in a row this set</span>
  <input type="range" min="0" max="6" value={gamesLostRow} onChange={e => setGamesLostRow(+e.target.value)} style={inputStyle} />
  <div style={{ fontSize: '14px', fontWeight: '500' }}>{gamesLostRow}</div>
</div>
<div style={{ marginBottom: '16px' }}>
        <span style={labelStyle}>First serve % — baseline {thresholds ? Math.round(thresholds.serve_baseline) : '...'}% · signal below {thresholds ? Math.round(thresholds.signal_threshold) : '...'}%</span>
        <input type="range" min="30" max="90" value={servePct} onChange={e => setServePct(+e.target.value)} style={inputStyle} />
        <div style={{ fontSize: '14px', fontWeight: '500' }}>{servePct}%</div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <span style={labelStyle}>Double faults this set</span>
        <input type="range" min="0" max="8" value={doubleFaults} onChange={e => setDoubleFaults(+e.target.value)} style={inputStyle} />
        <div style={{ fontSize: '14px', fontWeight: '500' }}>{doubleFaults}</div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <span style={labelStyle}>Break points missed this set</span>
        <input type="range" min="0" max="10" value={bpMissed} onChange={e => setBpMissed(+e.target.value)} style={inputStyle} />
        <div style={{ fontSize: '14px', fontWeight: '500' }}>{bpMissed}</div>
      </div>

      <div style={{ marginBottom: '16px' }}>
  <span style={labelStyle}>Unforced errors this set</span>
  <input type="range" min="0" max="20" value={unforcedErrors} onChange={e => setUnforcedErrors(+e.target.value)} style={inputStyle} />
  <div style={{ fontSize: '14px', fontWeight: '500' }}>{unforcedErrors}</div>
</div>

<div style={{ marginBottom: '16px' }}>
  <span style={labelStyle}>Winners this set</span>
  <input type="range" min="0" max="20" value={winners} onChange={e => setWinners(+e.target.value)} style={inputStyle} />
  <div style={{ fontSize: '14px', fontWeight: '500' }}>{winners} (W/E ratio: {(winners / Math.max(unforcedErrors, 1)).toFixed(2)})</div>
</div>

<div style={{ marginBottom: '16px' }}>
  <span style={labelStyle}>2nd serve points won %</span>
  <input type="range" min="20" max="80" value={secondServeWonPct} onChange={e => setSecondServeWonPct(+e.target.value)} style={inputStyle} />
  <div style={{ fontSize: '14px', fontWeight: '500' }}>{secondServeWonPct}%</div>
</div>

<div style={{ marginBottom: '16px' }}>
  <span style={labelStyle}>Aces this set</span>
  <input type="range" min="0" max="15" value={aces} onChange={e => setAces(+e.target.value)} style={inputStyle} />
  <div style={{ fontSize: '14px', fontWeight: '500' }}>{aces}</div>
</div>

<div style={{ marginBottom: '16px' }}>
  <span style={labelStyle}>Average rally length (shots)</span>
  <input type="range" min="1" max="12" value={avgRallyLength} onChange={e => setAvgRallyLength(+e.target.value)} style={inputStyle} />
  <div style={{ fontSize: '14px', fontWeight: '500' }}>{avgRallyLength} shots</div>
</div>

<div style={{ marginBottom: '16px' }}>
  <span style={labelStyle}>First serve speed avg (km/h)</span>
  <input type="range" min="140" max="220" value={firstServeSpeed} onChange={e => setFirstServeSpeed(+e.target.value)} style={inputStyle} />
  <div style={{ fontSize: '14px', fontWeight: '500' }}>{firstServeSpeed} km/h</div>
</div>

<div style={{ marginBottom: '16px' }}>
  <span style={labelStyle}>Break points created this set</span>
  <input type="range" min="0" max="12" value={bpCreated} onChange={e => setBpCreated(+e.target.value)} style={inputStyle} />
  <div style={{ fontSize: '14px', fontWeight: '500' }}>{bpCreated} (converted: {bpCreated - bpMissed > 0 ? bpCreated - bpMissed : 0})</div>
</div>
<div style={{ marginBottom: '16px' }}>
  <span style={labelStyle}>Service hold % this match</span>
  <input type="range" min="30" max="100" value={serviceHoldPct} onChange={e => setServiceHoldPct(+e.target.value)} style={inputStyle} />
  <div style={{ fontSize: '14px', fontWeight: '500' }}>{serviceHoldPct}%</div>
</div>
      <div style={{ marginBottom: '16px' }}>
        <span style={labelStyle}>Consecutive points lost</span>
        <input type="range" min="0" max="10" value={consecutivePoints} onChange={e => setConsecutivePoints(+e.target.value)} style={inputStyle} />
        <div style={{ fontSize: '14px', fontWeight: '500' }}>{consecutivePoints}</div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Set</span>
          <select value={setContext} onChange={e => setSetContext(+e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px' }}>
            <option value={1}>1st set</option>
            <option value={1.3}>2nd set</option>
            <option value={1.8}>3rd set</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Situation</span>
          <select value={situation} onChange={e => setSituation(+e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px' }}>
            <option value={1}>Normal game</option>
            <option value={1.3}>Serving to stay in set</option>
            <option value={1.5}>Leading, opp broke back</option>
            <option value={2}>Serving for set/match</option>
            <option value={2}>Tiebreak</option>
          </select>
        </div>
      </div>

      <span style={labelStyle}>Psychology flags</span>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <button style={flagStyle(flags.bodyLanguage, false)} onClick={() => toggleFlag('bodyLanguage')}>Body language</button>
        <button style={flagStyle(flags.umpireDispute, true)} onClick={() => toggleFlag('umpireDispute')}>Umpire dispute</button>
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button style={flagStyle(flags.thirdSetCollapse, true)} onClick={() => toggleFlag('thirdSetCollapse')}>3rd set collapse</button>
        <button style={flagStyle(flags.bpCascade, true)} onClick={() => toggleFlag('bpCascade')}>BP cascade</button>
        <button style={flagStyle(flags.lostFirstSetBagel, false)} onClick={() => toggleFlag('lostFirstSetBagel')}>Lost set 6-0/6-1</button>
        <button style={flagStyle(secondServePressure, true)} onClick={() => setSecondServePressure(!secondServePressure)}>2nd serve under pressure</button>
      </div>

    </div>
  );
}

export default MatchTracker;