const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// This is the main function Vercel runs when called
module.exports = async (req, res) => {
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { matchId } = req.body;

  if (!matchId) {
    return res.status(400).json({ error: 'matchId is required' });
  }

  try {
    // Step 1 — Fetch live match data from SofaScore
    const sofaResponse = await fetch(
      `https://api.sofascore.com/api/v1/event/${matchId}/statistics`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.sofascore.com'
        }
      }
    );

    if (!sofaResponse.ok) {
      return res.status(500).json({ error: 'SofaScore fetch failed' });
    }

    const sofaData = await sofaResponse.json();

    // Step 2 — Also fetch the score separately
    const scoreResponse = await fetch(
      `https://api.sofascore.com/api/v1/event/${matchId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.sofascore.com'
        }
      }
    );

    const scoreData = await scoreResponse.json();
    const event = scoreData.event;

    // Step 3 — Parse the stats from SofaScore format
    const stats = parseSofaStats(sofaData);

    // Step 4 — Parse the score
    const score = parseSofaScore(event);

    // Step 5 — Push everything to Supabase
    const { error } = await supabase
      .from('live_match')
      .upsert({
        match_id: matchId.toString(),
        player_a_name: event?.homeTeam?.name || '',
        player_b_name: event?.awayTeam?.name || '',
        tournament_name: event?.tournament?.name || '',
        status: event?.status?.description || '',

        // Score
        sets_a: score.setsA,
        sets_b: score.setsB,
        games_a: score.gamesA,
        games_b: score.gamesB,
        points_a: score.pointsA,
        points_b: score.pointsB,
        current_server: score.server,

        // Player A stats
        a_first_serve_pct: stats.a.firstServePct,
        a_double_faults: stats.a.doubleFaults,
        a_aces: stats.a.aces,
        a_winners: stats.a.winners,
        a_unforced_errors: stats.a.unforcedErrors,
        a_bp_won: stats.a.bpWon,
        a_bp_faced: stats.a.bpFaced,
        a_second_serve_won_pct: stats.a.secondServeWonPct,
        a_service_games_won: stats.a.serviceGamesWon,
        a_service_games_played: stats.a.serviceGamesPlayed,

        // Player B stats
        b_first_serve_pct: stats.b.firstServePct,
        b_double_faults: stats.b.doubleFaults,
        b_aces: stats.b.aces,
        b_winners: stats.b.winners,
        b_unforced_errors: stats.b.unforcedErrors,
        b_bp_won: stats.b.bpWon,
        b_bp_faced: stats.b.bpFaced,
        b_second_serve_won_pct: stats.b.secondServeWonPct,
        b_service_games_won: stats.b.serviceGamesWon,
        b_service_games_played: stats.b.serviceGamesPlayed,

        last_updated: new Date().toISOString()
      }, { onConflict: 'match_id' });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Supabase update failed' });
    }

    return res.status(200).json({ success: true, updated: new Date().toISOString() });

  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Parse SofaScore statistics response
function parseSofaStats(data) {
  const empty = {
    firstServePct: null,
    doubleFaults: 0,
    aces: 0,
    winners: 0,
    unforcedErrors: 0,
    bpWon: 0,
    bpFaced: 0,
    secondServeWonPct: null,
    serviceGamesWon: 0,
    serviceGamesPlayed: 0
  };

  if (!data?.statistics || !data.statistics.length) {
    return { a: empty, b: empty };
  }

  // SofaScore returns stats per period — get the last one (all periods combined)
  const allPeriods = data.statistics[data.statistics.length - 1];
  const groups = allPeriods?.groups || [];

  const a = { ...empty };
  const b = { ...empty };

  // Loop through stat groups and find the ones we need
  groups.forEach(group => {
    group.statisticsItems?.forEach(item => {
      const name = item.name?.toLowerCase();
      const homeVal = parseInt(item.home) || 0;
      const awayVal = parseInt(item.away) || 0;
      const homeRaw = item.home || '';
      const awayRaw = item.away || '';

      if (name?.includes('1st serve') && name?.includes('%')) {
        a.firstServePct = parseInt(homeRaw) || null;
        b.firstServePct = parseInt(awayRaw) || null;
      }
      if (name?.includes('double fault')) {
        a.doubleFaults = homeVal;
        b.doubleFaults = awayVal;
      }
      if (name === 'aces') {
        a.aces = homeVal;
        b.aces = awayVal;
      }
      if (name?.includes('winner') && !name?.includes('game')) {
        a.winners = homeVal;
        b.winners = awayVal;
      }
      if (name?.includes('unforced')) {
        a.unforcedErrors = homeVal;
        b.unforcedErrors = awayVal;
      }
      if (name?.includes('break point') && name?.includes('won')) {
        // Format is usually "X/Y"
        const homeWon = parseInt(homeRaw.split('/')[0]) || 0;
        const homeFaced = parseInt(homeRaw.split('/')[1]) || 0;
        const awayWon = parseInt(awayRaw.split('/')[0]) || 0;
        const awayFaced = parseInt(awayRaw.split('/')[1]) || 0;
        a.bpWon = homeWon;
        a.bpFaced = homeFaced;
        b.bpWon = awayWon;
        b.bpFaced = awayFaced;
      }
      if (name?.includes('2nd serve') && name?.includes('%')) {
        a.secondServeWonPct = parseInt(homeRaw) || null;
        b.secondServeWonPct = parseInt(awayRaw) || null;
      }
      if (name?.includes('service games won')) {
        const homeWon = parseInt(homeRaw.split('/')[0]) || 0;
        const homeTotal = parseInt(homeRaw.split('/')[1]) || 0;
        const awayWon = parseInt(awayRaw.split('/')[0]) || 0;
        const awayTotal = parseInt(awayRaw.split('/')[1]) || 0;
        a.serviceGamesWon = homeWon;
        a.serviceGamesPlayed = homeTotal;
        b.serviceGamesWon = awayWon;
        b.serviceGamesPlayed = awayTotal;
      }
    });
  });

  return { a, b };
}

// Parse score from SofaScore event
function parseSofaScore(event) {
  const score = {
    setsA: 0, setsB: 0,
    gamesA: 0, gamesB: 0,
    pointsA: '0', pointsB: '0',
    server: null
  };

  if (!event) return score;

  // Sets
  score.setsA = event.homeScore?.current || 0;
  score.setsB = event.awayScore?.current || 0;

  // Current game score (points)
  score.pointsA = event.homeScore?.display?.toString() || '0';
  score.pointsB = event.awayScore?.display?.toString() || '0';

  // Current games in set
  const periods = ['period1', 'period2', 'period3', 'period4', 'period5'];
  const currentPeriod = periods[score.setsA + score.setsB];
  if (currentPeriod) {
    score.gamesA = event.homeScore?.[currentPeriod] || 0;
    score.gamesB = event.awayScore?.[currentPeriod] || 0;
  }

  return score;
}