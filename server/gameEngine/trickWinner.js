export function determineTrickWinner({ playedCards, activeTrump }) {
  if (!playedCards || playedCards.length === 0) {
    return null;
  }

  const leadSuit = playedCards[0].card.suit;

  // 1. Check for any trump cards played
  const trumpPlays = playedCards.filter(p => p.card.suit === activeTrump);
  
  if (trumpPlays.length > 0) {
    // Sort descending by value
    trumpPlays.sort((a, b) => b.card.value - a.card.value);
    return trumpPlays[0]; // Returns { playerId, card }
  }

  // 2. Fall back to lead suit cards
  const leadSuitPlays = playedCards.filter(p => p.card.suit === leadSuit);
  leadSuitPlays.sort((a, b) => b.card.value - a.card.value);
  return leadSuitPlays[0]; // Returns { playerId, card }
}
