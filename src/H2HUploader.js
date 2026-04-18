import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function H2HUploader({ onBack }) {
  const [players, setPlayers] = useState([]);
  const [playerA, setPlayerA] = useState('');
  const [playerB, setPlayerB] = useState('');
  const [research, setResearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Load all players from database on mount
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
    // Basic validation
    if (!playerA || !playerB || playerA === playerB) {
      setStatus('Please select two different players.');
      return;
    }
    if (!research.trim()) {
      setStatus('Please paste your research before generating.');
      return;
    }

    setLoading(true);
    setStatus('Reading your research...');

    const playerAName = players.find(p => p.id === playerA)?.name;
    const playerBName = players.find(p => p.id === playerB)?.name;

    try {
      // Send research to Claude to structure it
      const prompt = `
You are a tennis data analyst. Read the following research about the head-to-head record between ${playerAName} and ${playerBName}.

Extract and return ONLY a JSON object with this exact structure, no other text:
{
  "total_matches": <number>,
  "player_a_wins": <number — wins for ${playerAName}>,
  "player_b_wins": <number — wins for ${playerBName}>,
  "clay_matches": <number>,
  "clay_a_wins": <number — clay wins for ${playerAName}>,
  "clay_b_wins": <number — clay wins for ${playerBName}>,
  "last_5_results": [
    {
      "date": "<YYYY-MM-DD or approximate year>",
      "tournament": "<tournament name>",
      "winner": "<winner name>",
      "score": "<score>",
      "surface": "<surface>"
    }
  ],
  "h2h_narrative": "<Write a detailed 3-5 sentence summary of the H2H dynamic, patterns, and what this means for betting. Include surface tendencies, momentum patterns, and any psychological edges.>"
}

If any data is not mentioned in the research, use null for that field.
Only return the JSON. No explanation, no markdown, no backticks.

RESEARCH:
${research}
      `;

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
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const rawText = data.content[0].text.trim();
const clean = rawText.replace(/```json|```/g, '').trim();
const structured = JSON.parse(clean);

      

      setStatus('Research structured. Saving to database...');

      // Check if H2H record already exists for these two players
      const { data: existing } = await supabase
        .from('head_to_head')
        .select('id')
        .or(
          `and(player_a_id.eq.${playerA},player_b_id.eq.${playerB}),` +
          `and(player_a_id.eq.${playerB},player_b_id.eq.${playerA})`
        )
        .maybeSingle();

      if (existing) {
        // Update existing record
        await supabase
          .from('head_to_head')
          .update({
            ...structured,
            player_a_id: playerA,
            player_b_id: playerB,
            last_updated: new Date().toISOString().split('T')[0]
          })
          .eq('id', existing.id);
      } else {
        // Insert new record
        await supabase
          .from('head_to_head')
          .insert({
            ...structured,
            player_a_id: playerA,
            player_b_id: playerB,
            last_updated: new Date().toISOString().split('T')[0]
          });
      }

      setStatus('✅ H2H data saved successfully!');
      setResearch('');

    } catch (err) {
      console.error(err);
      setStatus('❌ Something went wrong. Check the console for details.');
    }

    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53935', fontSize: 15 }}>
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>H2H Research Upload</h2>
      </div>

      {/* Player Selection */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Player A</label>
          <select
            value={playerA}
            onChange={e => setPlayerA(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}
          >
            <option value=''>Select player...</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Player B</label>
          <select
            value={playerB}
            onChange={e => setPlayerB(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}
          >
            <option value=''>Select player...</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Research Paste Box */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>
          Paste your research here — match history, stats, notes, anything
        </label>
        <textarea
          value={research}
          onChange={e => setResearch(e.target.value)}
          placeholder="e.g. De Minaur leads 3-1 overall vs Vacherot. Their only clay meeting was Monte Carlo 2025, won by De Minaur 6-4 6-3. Vacherot won their hard court meeting in Rotterdam 2024 in 3 sets. De Minaur has struggled on clay historically..."
          rows={12}
          style={{
            width: '100%', padding: '12px', borderRadius: 8,
            border: '1px solid #ddd', fontSize: 14, lineHeight: 1.6,
            resize: 'vertical', boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          width: '100%', padding: '14px', borderRadius: 8,
          background: loading ? '#ccc' : '#e53935',
          color: 'white', border: 'none', fontSize: 16,
          fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Generating...' : 'Generate & Save'}
      </button>

      {/* Status Message */}
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