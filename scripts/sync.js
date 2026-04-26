const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const matchId = process.argv[2];

if (!matchId) {
  console.log('Usage: node scripts/sync.js <matchId>');
  console.log('Example: node scripts/sync.js 16012166');
  process.exit(1);
}

console.log(`Starting live sync for match ${matchId}`);
console.log('Press Ctrl+C to stop\n');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com',
  'Cache-Control': 'no-cache'
};

async function sync() {
  try {
    // Fetch event
    const eventRes = await fetch(
      `https://api.sofascore.com/api/v1/event/${matchId}`,
      { headers }
    );

    if (!eventRes.ok) {
      console.log(`SofaScore error: ${eventRes.status}`);
      return;
    }

    const eventData = await eventRes.json();
    const event = eventData.event;

    if (!event) {
      console.log('No event data found');
      return;
    }

    // Fetch statistics
    const statsRes = await fetch(
      `https://api.sofascore.com/api/v1/event/${matchId}/statistics`,
      { headers }
    );

    let stats = { a: {}, b: {} };
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      stats = parseStats(statsData);
    }

    const score = parseScore(event);

    // Log what we're seeing
    console.log(`[${new Date().toLocaleTimeString()}] ${event.homeTeam?.name} vs ${event.awayTeam?.name}`);
    console.log(`Score: ${score.setsA}-${score.setsB} sets | ${score.gamesA}-${score.gamesB} games`);
    console.log(`1st serve: ${stats.a.firstServePct}% vs ${stats.b.firstServePct}%`);
    console.log(`Aces: ${stats.a.aces} vs ${stats.b.aces} | DFs: ${stats.a.doubleFaults} vs ${stats.b.doubleFaults}`);
    console.log(`Winners: ${stats.a.winners} vs ${stats.b.winners} | UE: ${stats.a.unforcedErrors} vs ${stats.b.unforcedErrors}`);
    console.log('---');

    // Push to Supabase
    const { error } = await supabase
      .from('live_match')
      .upsert({
        match_id: matchId.toString(),
        player_a_name: event.homeTeam?.name || '',
        player_b_name: event.awayTeam?.name || '',
        tournament_name: event.tournament?.name || '',
        status: event.status?.description || '',
        sets_a: score.setsA,
        sets_b: score.setsB,
        games_a: score.gamesA,
        games_b: score.gamesB,
        points_a: score.pointsA,
        points_b: score.pointsB,
        a_first_serve_pct: stats.a.firstServePct || null,
        a_double_faults: stats.a.doubleFaults || 0,
        a_aces: stats.a.aces || 0,
        a_winners: stats.a.winners || 0,
        a_unforced_errors: stats.a.unforcedErrors || 0,
        a_bp_won: stats.a.bpWon || 0,
        a_bp_faced: stats.a.bpFaced || 0,
        a_second_serve_won_pct: stats.a.secondServeWonPct || null,
        a_service_games_won: stats.a.serviceGamesWon || 0,
        a_service_games_played: stats.a.serviceGamesPlayed || 0,
        b_first_serve_pct: stats.b.firstServePct || null,
        b_double_faults: stats.b.doubleFaults || 0,
        b_aces: stats.b.aces || 0,
        b_winners: stats.b.winners || 0,
        b_unforced_errors: stats.b.unforcedErrors || 0,
        b_bp_won: stats.b.bpWon || 0,
        b_bp_faced: stats.b.bpFaced || 0,
        b_second_serve_won_pct: stats.b.secondServeWonPct || null,
        b_service_games_won: stats.b.serviceGamesWon || 0,
        b_service_games_played: stats.b.serviceGamesPlayed || 0,
        last_updated: new Date().toISOString()
      }, { onConflict: 'match_id' });

    if (error) {
      console.log('Supabase error:', error.message);
    } else {
      console.log('✅ Supabase updated\n');
    }

  } catch (err) {
    console.log('Error:', err.message);
  }
}

// Run immediately then every 30 seconds
sync();
setInterval(sync, 30000);