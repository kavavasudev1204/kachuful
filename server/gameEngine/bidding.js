export function getForbiddenBidForLastPlayer(cardsDealt, priorBidsSum) {
  const forbidden = cardsDealt - priorBidsSum;
  return forbidden >= 0 ? forbidden : null;
}

export function validateBid({
  bid,
  cardsDealt,
  priorBidsSum,
  isLastPlayer,
  enableLastBidRestriction
}) {
  if (bid < 0 || bid > cardsDealt) {
    return { valid: false, message: `Bid must be between 0 and ${cardsDealt}.` };
  }

  if (enableLastBidRestriction && isLastPlayer) {
    const forbidden = getForbiddenBidForLastPlayer(cardsDealt, priorBidsSum);
    if (forbidden !== null && bid === forbidden) {
      return {
        valid: false,
        forbiddenBid: forbidden,
        message: `Last player cannot bid ${forbidden} (sum of bids cannot equal number of cards: ${cardsDealt}).`
      };
    }
  }

  return { valid: true };
}
