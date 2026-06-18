const SUITS = ["SPADE", "HEART", "CLUB", "DIAMOND"];
const RANKS = [
  { rank: "2", value: 2 },
  { rank: "3", value: 3 },
  { rank: "4", value: 4 },
  { rank: "5", value: 5 },
  { rank: "6", value: 6 },
  { rank: "7", value: 7 },
  { rank: "8", value: 8 },
  { rank: "9", value: 9 },
  { rank: "10", value: 10 },
  { rank: "J", value: 11 },
  { rank: "Q", value: 12 },
  { rank: "K", value: 13 },
  { rank: "A", value: 14 }
];

export function generateDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const r of RANKS) {
      deck.push({
        suit,
        rank: r.rank,
        value: r.value
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(deck, cardsPerPlayer, playerIds) {
  const hands = {};
  const tempDeck = [...deck];
  
  for (const id of playerIds) {
    hands[id] = [];
  }
  
  for (let i = 0; i < cardsPerPlayer; i++) {
    for (const id of playerIds) {
      if (tempDeck.length > 0) {
        hands[id].push(tempDeck.shift());
      }
    }
  }
  
  return {
    hands,
    remainingDeck: tempDeck
  };
}
