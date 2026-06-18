const TRUMPS = ["SPADE", "HEART", "CLUB", "DIAMOND"];

export function getTrumpForRound(round) {
  // round is 1-based
  const index = (round - 1) % TRUMPS.length;
  return TRUMPS[index];
}

export function getTrumpSymbol(suit) {
  switch (suit) {
    case "SPADE": return "♠";
    case "HEART": return "♥";
    case "CLUB": return "♣";
    case "DIAMOND": return "♦";
    default: return "";
  }
}
