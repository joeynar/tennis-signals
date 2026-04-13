import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import MatchTracker from './MatchTracker';
import H2HUploader from './H2HUploader'; 

function App() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showH2H, setShowH2H] = useState(false);
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