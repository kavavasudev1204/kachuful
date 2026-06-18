export function calculateRoundScore({ guess, won, scoreMode }) {
  if (guess !== won) {
    return 0;
  }

  if (scoreMode === "MULTIPLY_10") {
    if (guess === 0) {
      return 10;
    }
    return won * 10;
  } else {
    // Default: ADD_10
    return 10 + won;
  }
}

export function calculateScoresForRound({ players, bids, tricksWon, scoreMode }) {
  const roundScores = {};
  
  for (const player of players) {
    const id = player.id;
    const guess = bids[id] ?? 0;
    const won = tricksWon[id] ?? 0;
    roundScores[id] = calculateRoundScore({ guess, won, scoreMode });
  }
  
  return roundScores;
}
