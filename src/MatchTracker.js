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

  useEffect(() => {
    fetchThresholds();
  }, [player]);

  useEffect(() => {
    calculateScore();
  }, [servePct, doubleFaults, bpMissed, consecutivePoints, setContext, situation, flags, thresholds]);

  async function fetchThresholds() {
    const { data } = await supabase
      .from('signal_thresholds')
      .select('*')
      .eq('player_id', player.id)
      .eq('surface', 'clay')
      .single();
    if (data) setThresholds(data);
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

    let flagScore = 0;
    if (flags.bodyLanguage) flagScore += 8;
    if (flags.umpireDispute) flagScore += 15;
    if (flags.thirdSetCollapse) flagScore += 18;
    if (flags.bpCascade) flagScore += 10;
    if (flags.lostFirstSetBagel) flagScore += 12;

    const raw = serveScore + dfScore + moScore + bpScore;
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
  - Current first serve %: ${servePct}% (${thresh ? (servePct < thresh.signal_threshold ? 'BELOW SIGNAL THRESHOLD' : servePct < thresh.warn_threshold ? 'IN WATCH ZONE' : 'NORMAL') : ''})
  - Double faults this set: ${doubleFaults}
  - Break points missed: ${bpMissed}
  - Consecutive points lost: ${consecutivePoints}
  - Set: ${setContext === 1 ? '1st' : setContext === 1.3 ? '2nd' : '3rd'}
  - Situation: ${situation === 2 ? 'Serving for set/match or tiebreak' : situation === 1.5 ? 'Leading but opponent broke back' : situation === 1.3 ? 'Serving to stay in set' : 'Normal game'}
  - Active flags: ${Object.entries(flags).filter(([k,v]) => v).map(([k]) => k).join(', ') || 'None'}
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
}} style={{ fontSize: '12px', color: '#E24B4A', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', marginLeft: '12px' }}>
  Reset match
</button>
      <input 
  type="text"
  placeholder="Opponent name"
  value={opponent}
  onChange={e => setOpponent(e.target.value)}
  style={{ width: '100%', marginBottom: '12px', fontSize: '13px', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
/>

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
      </div>

    </div>
  );
}

export default MatchTracker;