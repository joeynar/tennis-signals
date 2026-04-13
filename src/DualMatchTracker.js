import { useState, useEffect } from 'react';
import { supabase } from './supabase';

// Signal scoring logic — mirrors MatchTracker exactly
function calculateSignalScore(stats, thresholds) {
  if (!thresholds) return 0;

  const { servePct, set1Serve, set2Serve, doubleFaults, bpMissed,
    consecutivePoints, gamesLost, setContext, situation,
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

  const raw = serveScore + dfScore + moScore + bpScore + trendScore + gamesScore;
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

  // Load all players on mount
  useEffect(() => {
    supabase.from('players').select('id, name, ranking, nationality, hand, style_notes, collapse_triggers')
      .order('name').then(({ data }) => { if (data) setPlayers(data); });
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

  const scoreA = calculateSignalScore(statsA, thresholdsA);
  const scoreB = calculateSignalScore(statsB, thresholdsB);

  async function getDualPrediction() {
    if (!playerA || !playerB) return;
    setLoadingPrediction(true);
    setPrediction('');

    const prompt = `
You are a live tennis betting analyst. Analyze both players in this match and provide a dual assessment.

TOURNAMENT: ${tournament || 'Unknown'}

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
      <input
        value={tournament}
        onChange={e => setTournament(e.target.value)}
        placeholder="Tournament (e.g. Monte Carlo Masters QF)"
        style={{
          width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #ddd',
          fontSize: 14, marginBottom: 20, boxSizing: 'border-box'
        }}
      />

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