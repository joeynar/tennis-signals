import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import MatchTracker from './MatchTracker';
import H2HUploader from './H2HUploader'; 
import DualMatchTracker from './DualMatchTracker';
import TournamentUploader from './TournamentUploader';
import PrematchUploader from './PrematchUploader';
import LiveMatchSelector from './LiveMatchSelector';

function App() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showH2H, setShowH2H] = useState(false);
  const [showDual, setShowDual] = useState(false);
  const [showTournament, setShowTournament] = useState(false);
  const [showPrematch, setShowPrematch] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [activeMatch, setActiveMatch] = useState(null);
  useEffect(() => {
    fetchPlayers();
  }, []);

  async function fetchPlayers() {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('name');
    if (error) console.error('Error:', error);
    else setPlayers(data);
    setLoading(false);
  }
  if (showLive) {
    return <LiveMatchSelector
      onBack={() => setShowLive(false)}
      onMatchSelected={(match) => {
        setActiveMatch(match);
        setShowLive(false);
      }}
    />;
  }
  if (showPrematch) {
    return <PrematchUploader onBack={() => setShowPrematch(false)} />;
  }
  if (showTournament) {
    return <TournamentUploader onBack={() => setShowTournament(false)} />;
  }
  if (showDual) {
    return <DualMatchTracker onBack={() => setShowDual(false)} />;
  }
  if (showH2H) {
  return <H2HUploader onBack={() => setShowH2H(false)} />;
}
  if (selectedPlayer) {
    return <MatchTracker player={selectedPlayer} onBack={() => setSelectedPlayer(null)} />;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '500', marginBottom: '6px' }}>Tennis Signals</h1>
      <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>Select a player to open live match tracker</p>
      <button
  onClick={() => setShowH2H(true)}
  style={{
    width: '100%', padding: '14px', borderRadius: 8, marginBottom: 24,
    background: '#1a1a2e', color: 'white', border: 'none',
    fontSize: 15, fontWeight: 600, cursor: 'pointer'
  }}
>
  + Upload H2H Research
</button>
<button
  onClick={() => setShowDual(true)}
  style={{
    width: '100%', padding: '14px', borderRadius: 8, marginBottom: 24,
    background: '#e53935', color: 'white', border: 'none',
    fontSize: 15, fontWeight: 600, cursor: 'pointer'
  }}
>
  ⚡ Dual Match Analysis
</button>
<button
  onClick={() => setShowTournament(true)}
  style={{
    width: '100%', padding: '14px', borderRadius: 8, marginBottom: 24,
    background: '#2e7d32', color: 'white', border: 'none',
    fontSize: 15, fontWeight: 600, cursor: 'pointer'
  }}
>
  🏆 Upload Tournament Profile
</button>
<button
  onClick={() => setShowPrematch(true)}
  style={{
    width: '100%', padding: '14px', borderRadius: 8, marginBottom: 24,
    background: '#7b1fa2', color: 'white', border: 'none',
    fontSize: 15, fontWeight: 600, cursor: 'pointer'
  }}
>
  📊 Upload Pre-Match Research
</button>
<button
  onClick={() => setShowLive(true)}
  style={{
    width: '100%', padding: '14px', borderRadius: 8, marginBottom: 24,
    background: '#e53935', color: 'white', border: 'none',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
  }}
>
  ● Live Auto-Track
</button>

      {loading ? (
        <p>Loading...</p>
      ) : (
        players.map(player => (
          <div key={player.id} onClick={() => setSelectedPlayer(player)}
            style={{ padding: '16px', border: '1px solid #eee', borderRadius: '10px', marginBottom: '10px', cursor: 'pointer' }}>
            <div style={{ fontWeight: '500', fontSize: '16px' }}>{player.name}</div>
            <div style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>Ranked #{player.ranking} · {player.nationality} · {player.hand}-handed · tap to track</div>
          </div>
        ))
      )}
    </div>
  );
}

export default App;