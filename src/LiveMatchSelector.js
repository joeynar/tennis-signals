import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function LiveMatchSelector({ onBack, onMatchSelected }) {
  const [matchId, setMatchId] = useState('');
  const [playerAName, setPlayerAName] = useState('');
  const [playerBName, setPlayerBName] = useState('');
  const [tournament, setTournament] = useState('');
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('players').select('id, name')
      .then(({ data }) => { if (data) setPlayers(data); });
  }, []);

  function findPlayer(name) {
    const lower = name.toLowerCase();
    return players.find(p =>
      lower.includes(p.name.toLowerCase().split(' ').pop()) ||
      p.name.toLowerCase().includes(lower.split(' ').pop())
    );
  }

  async function activateMatch() {
    if (!matchId.trim()) {
      setStatus('Please enter a SofaScore match ID.');
      return;
    }
    if (!playerAName.trim() || !playerBName.trim()) {
      setStatus('Please enter both player names.');
      return;
    }

    setLoading(true);
    setStatus('Activating...');

    const playerA = findPlayer(playerAName);
    const playerB = findPlayer(playerBName);

    const { error } = await supabase
      .from('live_match')
      .upsert({
        match_id: matchId.trim(),
        player_a_name: playerAName.trim(),
        player_b_name: playerBName.trim(),
        player_a_id: playerA?.id || null,
        player_b_id: playerB?.id || null,
        tournament_name: tournament.trim(),
        status: 'live',
        last_updated: new Date().toISOString()
      }, { onConflict: 'match_id' });

    if (error) {
      setStatus('❌ Error saving match. Check console.');
      setLoading(false);
      return;
    }

    // Start polling immediately
    try {
      await fetch('/api/live-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchId.trim() })
      });
    } catch (err) {
      console.log('First sync attempted:', err);
    }

    // Set up polling every 30 seconds
    if (window._liveMatchInterval) clearInterval(window._liveMatchInterval);
    window._liveMatchInterval = setInterval(async () => {
      try {
        await fetch('/api/live-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: matchId.trim() })
        });
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 30000);

    setStatus('✅ Live tracking activated!');
    setLoading(false);

    setTimeout(() => {
      onMatchSelected({
        matchId: matchId.trim(),
        playerAName: playerAName.trim(),
        playerBName: playerBName.trim(),
        playerAId: playerA?.id || null,
        playerBId: playerB?.id || null,
        tournament: tournament.trim()
      });
    }, 1000);
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53935', fontSize: 15 }}>
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Live Auto-Track</h2>
      </div>

      {/* How to find match ID */}
      <div style={{
        padding: '12px 14px', borderRadius: 8, marginBottom: 20,
        background: '#e3f2fd', border: '1px solid #90caf9'
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1565c0', marginBottom: 4 }}>
          How to find the SofaScore Match ID
        </div>
        <div style={{ fontSize: 11, color: '#1976d2', lineHeight: 1.6 }}>
          1. Open SofaScore and find the match<br/>
          2. Click on the match to open it<br/>
          3. Look at the URL — it ends with a number e.g. sofascore.com/tennis/.../12345678<br/>
          4. That number is your Match ID — paste it below
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>
          SofaScore Match ID
        </label>
        <input
          value={matchId}
          onChange={e => setMatchId(e.target.value)}
          placeholder="e.g. 12345678"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>
            Player A (Home)
          </label>
          <input
            value={playerAName}
            onChange={e => setPlayerAName(e.target.value)}
            placeholder="e.g. Moutet"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box'
            }}
          />
          {playerAName && (
            <div style={{ fontSize: 11, marginTop: 4, color: findPlayer(playerAName) ? '#2e7d32' : '#e65100' }}>
              {findPlayer(playerAName) ? `✓ Found: ${findPlayer(playerAName).name}` : '⚠ Not in database'}
            </div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>
            Player B (Away)
          </label>
          <input
            value={playerBName}
            onChange={e => setPlayerBName(e.target.value)}
            placeholder="e.g. Musetti"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box'
            }}
          />
          {playerBName && (
            <div style={{ fontSize: 11, marginTop: 4, color: findPlayer(playerBName) ? '#2e7d32' : '#e65100' }}>
              {findPlayer(playerBName) ? `✓ Found: ${findPlayer(playerBName).name}` : '⚠ Not in database'}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>
          Tournament (optional)
        </label>
        <input
          value={tournament}
          onChange={e => setTournament(e.target.value)}
          placeholder="e.g. Madrid Open R16"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box'
          }}
        />
      </div>

      <button
        onClick={activateMatch}
        disabled={loading}
        style={{
          width: '100%', padding: '14px', borderRadius: 8,
          background: loading ? '#ccc' : '#e53935',
          color: 'white', border: 'none', fontSize: 16,
          fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Activating...' : '⚡ Start Live Tracking'}
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