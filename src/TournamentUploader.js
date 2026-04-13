import { useState } from 'react';
import { supabase } from './supabase';

export default function TournamentUploader({ onBack }) {
  const [tournamentName, setTournamentName] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [research, setResearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!tournamentName.trim()) {
      setStatus('Please enter the tournament name.');
      return;
    }
    if (!research.trim()) {
      setStatus('Please paste your research before generating.');
      return;
    }

    setLoading(true);
    setStatus('Reading your research...');

    try {
      const prompt = `You are a tennis betting analyst. Read the following tournament research and extract the key information. Return ONLY a JSON object with this exact structure, no other text, no markdown, no backticks: {"surface": "clay, hard, grass, or indoor clay","surface_speed": 0.57,"atp_level": "ATP 250, ATP 500, ATP 1000, or Grand Slam","location": "city, country","conditions_narrative": "3-4 sentences summarising what makes this tournament unique","upgrade_profile": "2-3 sentences on which player types perform better here and why","downgrade_profile": "2-3 sentences on which player types struggle here and why","live_triggers": "2-3 sentences on what to watch in the first 2 service games live","weather_overlay": "2-3 sentences on how weather affects the court","historical_notes": "2-3 sentences on favorite vs underdog history"}. If any field is not mentioned in the research, use null. Only return the JSON. RESEARCH: ${research}`;

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

      const { data: existing } = await supabase
        .from('tournament_profiles')
        .select('id')
        .ilike('tournament_name', tournamentName.trim())
        .eq('year', year)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('tournament_profiles')
          .update({
            ...structured,
            tournament_name: tournamentName.trim(),
            year: year,
            raw_notes: research,
            last_updated: new Date().toISOString().split('T')[0]
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('tournament_profiles')
          .insert({
            ...structured,
            tournament_name: tournamentName.trim(),
            year: year,
            raw_notes: research,
            last_updated: new Date().toISOString().split('T')[0]
          });
      }

      setStatus('✅ Tournament profile saved successfully!');
      setResearch('');
      setTournamentName('');

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
          Back
        </button>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Tournament Profile Upload</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>
            Tournament Name
          </label>
          <input
            value={tournamentName}
            onChange={e => setTournamentName(e.target.value)}
            placeholder="e.g. Barcelona Open"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>
            Year
          </label>
          <input
            type="number"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>
          Paste your tournament research here
        </label>
        <textarea
          value={research}
          onChange={e => setResearch(e.target.value)}
          placeholder="Paste full tournament report here..."
          rows={14}
          style={{
            width: '100%', padding: '12px', borderRadius: 8,
            border: '1px solid #ddd', fontSize: 14, lineHeight: 1.6,
            resize: 'vertical', boxSizing: 'border-box'
          }}
        />
      </div>

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