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
    if (total >= 75) setAlertLevel('high');
    else if (total >= 60) setAlertLevel('medium');
    else if (total >= 35) setAlertLevel('watch');
    else setAlertLevel('none');
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