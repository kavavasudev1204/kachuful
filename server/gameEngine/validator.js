export function validateCardPlay({ card, playerHand, leadSuit }) {
  // 1. Verify card ownership
  const hasCard = playerHand.some(
    c => c.suit === card.suit && c.rank === card.rank
  );
  if (!hasCard) {
    return { valid: false, message: "You do not own this card in your hand." };
  }

  // 2. Enforce follow lead suit rule
  if (leadSuit) {
    const hasLeadSuit = playerHand.some(c => c.suit === leadSuit);
    if (hasLeadSuit && card.suit !== leadSuit) {
      return {
        valid: false,
        message: `Must play lead suit card of type: ${leadSuit}`
      };
    }
  }

  return { valid: true };
}
