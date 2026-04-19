import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function PrematchUploader({ onBack }) {
  const [players, setPlayers] = useState([]);
  const [playerAId, setPlayerAId] = useState('');
  const [playerBId, setPlayerBId] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [research, setResearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchPlayers() {
      const { data } = await supabase
        .from('players')
        .select('id, name')
        .order('name');
      if (data) setPlayers(data);
    }
    fetchPlayers();
  }, []);

  async function handleGenerate() {
    if (!playerAId || !playerBId || playerAId === playerBId) {
      setStatus('Please select two different players.');
      return;
    }
    if (!research.trim()) {
      setStatus('Please paste your pre-match research first.');
      return;
    }

    setLoading(true);
    setStatus('Reading the research report...');

    const playerAName = players.find(p => p.id === playerAId)?.name;
    const playerBName = players.find(p => p.id === playerBId)?.name;

    try {
      const prompt = `You are a tennis betting analyst. Read this pre-match research report on ${playerAName} vs ${playerBName} and extract structured data.

Return ONLY a JSON object with this exact structure, no markdown, no backticks:
{
  "surface": "clay/hard/grass/indoor",
  "model_prob_a": <decimal 0-1, e.g. 0.55>,
  "model_prob_b": <decimal 0-1>,
  "market_prob_a": <decimal 0-1>,
  "market_prob_b": <decimal 0-1>,
  "market_error_pp": <decimal, the percentage point gap>,
  "ml_odds_a": <decimal odds>,
  "ml_odds_b": <decimal odds>,
  "primary_bet": "<the recommended primary bet with stake e.g. Player A ML @ 2.49 (0.6u)>",
  "primary_ev_pct": <decimal>,
  "secondary_bet": "<secondary bet if any>",
  "secondary_ev_pct": <decimal or null>,
  "fade_list": "<comma-separated list of bets to avoid with reasons>",
  "live_triggers": "<key signals to watch in first 2-3 service games>",
  "player_a_form_summary": "<3-4 sentences on ${playerAName}'s recent form, key stats, edge>",
  "player_b_form_summary": "<3-4 sentences on ${playerBName}'s recent form, key stats, edge>",
  "weather_notes": "<weather and how it affects the match>",
  "surface_speed_notes": "<surface speed and tactical implications>",
  "model_verdict": "<3-4 sentence final prediction with reasoning>",
  "most_likely_score": "<e.g. Player A 2-1>"
}

Use null for any field not mentioned. Return ONLY the JSON.

RESEARCH:
${research}`;

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
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const rawText = data.content[0].text.trim();
      const clean = rawText.replace(/```json|```/g, '').trim();
      const structured = JSON.parse(clean);

      setStatus('Research structured. Saving to database...');

      const { data: existing } = await supabase
        .from('prematch_research')
        .select('id')
        .or(
          `and(player_a_id.eq.${playerAId},player_b_id.eq.${playerBId}),` +
          `and(player_a_id.eq.${playerBId},player_b_id.eq.${playerAId})`
        )
        .eq('match_date', matchDate)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('prematch_research')
          .update({
            ...structured,
            player_a_id: playerAId,
            player_b_id: playerBId,
            tournament_name: tournamentName,
            match_date: matchDate,
            raw_research: research
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('prematch_research')
          .insert({
            ...structured,
            player_a_id: playerAId,
            player_b_id: playerBId,
            tournament_name: tournamentName,
            match_date: matchDate,
            raw_research: research
          });
      }

      setStatus('✅ Pre-match research saved successfully!');
      setResearch('');

    } catch (err) {
      console.error(err);
      setStatus('❌ Something went wrong. Check the console for details.');
    }

    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53935', fontSize: 15 }}>
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Pre-Match Research Upload</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Player A</label>
          <select value={playerAId} onChange={e => setPlayerAId(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}>
            <option value=''>Select player...</option>
            {players.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Player B</label>
          <select value={playerBId} onChange={e => setPlayerBId(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}>
            <option value=''>Select player...</option>
            {players.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Tournament</label>
          <input value={tournamentName} onChange={e => setTournamentName(e.target.value)}
            placeholder="e.g. Barcelona Open R32"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box' }}/>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Match Date</label>
          <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box' }}/>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>
          Paste the full pre-match research report
        </label>
        <textarea value={research} onChange={e => setResearch(e.target.value)}
          placeholder="Paste your full match analysis report here — model probabilities, market odds, EV calculations, live triggers, form indicators, etc."
          rows={20}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd', fontSize: 13, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }}/>
      </div>

      <button onClick={handleGenerate} disabled={loading}
        style={{
          width: '100%', padding: 14, borderRadius: 8,
          background: loading ? '#ccc' : '#7b1fa2',
          color: 'white', border: 'none', fontSize: 16, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer'
        }}>
        {loading ? 'Generating...' : 'Generate & Save'}
      </button>

      {status && (
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 8,
          background: status.includes('✅') ? '#e8f5e9' : status.includes('❌') ? '#ffebee' : '#fff3e0',
          color: status.includes('✅') ? '#2e7d32' : status.includes('❌') ? '#c62828' : '#e65100',
          fontSize: 14, fontWeight: 500
        }}>
          {status}
        </div>
      )}
    </div>
  );
}