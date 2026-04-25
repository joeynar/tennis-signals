const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { matchId } = req.body;
  if (!matchId) return res.status(400).json({ error: 'matchId required' });

  try {
    // Fetch match data from SofaScore with full browser headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.sofascore.com/',
      'Origin': 'https://www.sofascore.com',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site'
    };

    // Fetch event details
    const eventRes = await fetch(
      `https://api.sofascore.com/api/v1/event/${matchId}`,
      { headers }
    );

    if (!eventRes.ok) {
      console.error('SofaScore event fetch failed:', eventRes.status);
      return res.status(500).json({ 
        error: `SofaScore returned ${eventRes.status}`,
        matchId 
      });
    }

    const eventData = await eventRes.json();
    const event = eventData.event;

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

    // Parse score
    const score = parseScore(event);

    // Push to Supabase
    const { error: dbError } = await supabase
      .from('live_match')
      .upsert({
        match_id: matchId.toString(),
        player_a_name: event?.homeTeam?.name || '',
        player_b_name: event?.awayTeam?.name || '',
        tournament_name: event?.tournament?.name || '',
        status: event?.status?.description || '',
        sets_a: score.setsA,
        sets_b: score.setsB,
        games_a: score.gamesA,
        games_b: score.gamesB,
        points_a: score.pointsA,
        points_b: score.pointsB,
        current_server: score.server,
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

    if (dbError) {
      console.error('Supabase error:', dbError);
      return res.status(500).json({ error: 'Database update failed' });
    }

    return res.status(200).json({ 
      success: true, 
      player_a: event?.homeTeam?.name,
      player_b: event?.awayTeam?.name,
      score: `${score.setsA}-${score.setsB}`,
      updated: new Date().toISOString()
    });

  } catch (err) {
    console.error('Sync error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

function parseStats(data) {
  const empty = {
    firstServePct: null, doubleFaults: 0, aces: 0,
    winners: 0, unforcedErrors: 0, bpWon: 0, bpFaced: 0,
    secondServeWonPct: null, serviceGamesWon: 0, serviceGamesPlayed: 0
  };

  if (!data?.statistics?.length) return { a: empty, b: empty };

  const allPeriods = data.statistics[data.statistics.length - 1];
  const groups = allPeriods?.groups || [];
  const a = { ...empty };
  const b = { ...empty };

  groups.forEach(group => {
    group.statisticsItems?.forEach(item => {
      const name = item.name?.toLowerCase() || '';
      const homeRaw = item.home || '';
      const awayRaw = item.away || '';
      const homeVal = parseInt(homeRaw) || 0;
      const awayVal = parseInt(awayRaw) || 0;

      if (name.includes('1st serve') && name.includes('%')) {
        a.firstServePct = parseInt(homeRaw) || null;
        b.firstServePct = parseInt(awayRaw) || null;
      }
      if (name.includes('double fault')) {
        a.doubleFaults = homeVal;
        b.doubleFaults = awayVal;
      }
      if (name === 'aces') {
        a.aces = homeVal;
        b.aces = awayVal;
      }
      if (name.includes('winner') && !name.includes('game')) {
        a.winners = homeVal;
        b.winners = awayVal;
      }
      if (name.includes('unforced')) {
        a.unforcedErrors = homeVal;
        b.unforcedErrors = awayVal;
      }
      if (name.includes('break point') && name.includes('won')) {
        a.bpWon = parseInt(homeRaw.split('/')[0]) || 0;
        a.bpFaced = parseInt(homeRaw.split('/')[1]) || 0;
        b.bpWon = parseInt(awayRaw.split('/')[0]) || 0;
        b.bpFaced = parseInt(awayRaw.split('/')[1]) || 0;
      }
      if (name.includes('2nd serve') && name.includes('%')) {
        a.secondServeWonPct = parseInt(homeRaw) || null;
        b.secondServeWonPct = parseInt(awayRaw) || null;
      }
      if (name.includes('service games won')) {
        a.serviceGamesWon = parseInt(homeRaw.split('/')[0]) || 0;
        a.serviceGamesPlayed = parseInt(homeRaw.split('/')[1]) || 0;
        b.serviceGamesWon = parseInt(awayRaw.split('/')[0]) || 0;
        b.serviceGamesPlayed = parseInt(awayRaw.split('/')[1]) || 0;
      }
    });
  });

  return { a, b };
}

function parseScore(event) {
  const score = {
    setsA: 0, setsB: 0,
    gamesA: 0, gamesB: 0,
    pointsA: '0', pointsB: '0',
    server: null
  };

  if (!event) return score;

  score.setsA = event.homeScore?.current || 0;
  score.setsB = event.awayScore?.current || 0;
  score.pointsA = event.homeScore?.display?.toString() || '0';
  score.pointsB = event.awayScore?.display?.toString() || '0';

  const periods = ['period1', 'period2', 'period3', 'period4', 'period5'];
  const currentPeriod = periods[score.setsA + score.setsB];
  if (currentPeriod) {
    score.gamesA = event.homeScore?.[currentPeriod] || 0;
    score.gamesB = event.awayScore?.[currentPeriod] || 0;
  }

  return score;
}