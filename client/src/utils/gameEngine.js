// Kachuful Game Engine & Bot Logic for Client (Offline Simulation)

// 1. DECK ENGINE
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
      deck.push({ suit, rank: r.rank, value: r.value });
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
  return { hands, remainingDeck: tempDeck };
}

// 2. TRUMP ENGINE
export function getTrumpForRound(round) {
  const index = (round - 1) % SUITS.length;
  return SUITS[index];
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

// 3. BID ENGINE
export function getForbiddenBidForLastPlayer(cardsDealt, priorBidsSum) {
  const forbidden = cardsDealt - priorBidsSum;
  return forbidden >= 0 ? forbidden : null;
}

export function validateBid({ bid, cardsDealt, priorBidsSum, isLastPlayer, enableLastBidRestriction }) {
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

// 4. VALIDATOR ENGINE
export function validateCardPlay({ card, playerHand, leadSuit }) {
  const hasCard = playerHand.some(c => c.suit === card.suit && c.rank === card.rank);
  if (!hasCard) {
    return { valid: false, message: "You do not own this card in your hand." };
  }
  if (leadSuit) {
    const hasLeadSuit = playerHand.some(c => c.suit === leadSuit);
    if (hasLeadSuit && card.suit !== leadSuit) {
      return { valid: false, message: `Must play lead suit card of type: ${leadSuit}` };
    }
  }
  return { valid: true };
}

// 5. TRICK WINNER ENGINE
export function determineTrickWinner({ playedCards, activeTrump }) {
  if (!playedCards || playedCards.length === 0) return null;
  const leadSuit = playedCards[0].card.suit;
  const trumpPlays = playedCards.filter(p => p.card.suit === activeTrump);
  if (trumpPlays.length > 0) {
    trumpPlays.sort((a, b) => b.card.value - a.card.value);
    return trumpPlays[0];
  }
  const leadSuitPlays = playedCards.filter(p => p.card.suit === leadSuit);
  leadSuitPlays.sort((a, b) => b.card.value - a.card.value);
  return leadSuitPlays[0];
}

// 6. SCORE ENGINE
export function calculateRoundScore({ guess, won, scoreMode }) {
  if (guess !== won) return 0;
  if (scoreMode === "MULTIPLY_10") {
    return guess === 0 ? 10 : won * 10;
  }
  return 10 + won;
}

// 7. GAME STATE REDUCER
export function initGame(players, config = {}) {
  const scoreMode = config.scoreMode || "ADD_10";
  const enableLastBidRestriction = config.enableLastBidRestriction !== false;
  const maxRounds = config.maxRounds || Math.floor(52 / players.length);
  
  const scores = {};
  for (const p of players) {
    scores[p.id] = [];
  }

  const state = {
    phase: "bidding",
    round: 1,
    maxRounds,
    cardsPerPlayer: 1,
    dealerIndex: 0,
    currentTurn: 0,
    trump: getTrumpForRound(1),
    deck: [],
    hands: {},
    bids: {},
    tricksWon: {},
    scores,
    playedCards: [],
    roundHistory: [],
    continueBy: null,
    lastTrickWinner: null,
    scoreMode,
    enableLastBidRestriction,
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot || false
    }))
  };

  return startRound(state);
}

export function startRound(state) {
  const playerCount = state.players.length;
  state.cardsPerPlayer = state.round;
  state.trump = getTrumpForRound(state.round);
  
  const deck = shuffleDeck(generateDeck());
  const { hands, remainingDeck } = dealCards(deck, state.cardsPerPlayer, state.players.map(p => p.id));
  
  state.deck = remainingDeck;
  state.hands = hands;
  state.bids = {};
  state.playedCards = [];
  state.continueBy = null;
  state.lastTrickWinner = null;
  state.phase = "bidding";
  
  state.tricksWon = {};
  for (const p of state.players) {
    state.tricksWon[p.id] = 0;
  }
  
  state.currentTurn = (state.dealerIndex + 1) % playerCount;
  return state;
}

export function placeBid(state, playerId, bid) {
  if (state.phase !== "bidding") return state;

  const activePlayer = state.players[state.currentTurn];
  if (activePlayer.id !== playerId) return state;

  const priorBidsSum = Object.values(state.bids).reduce((sum, val) => sum + val, 0);
  const bidsCount = Object.keys(state.bids).length;
  const isLastPlayer = bidsCount === state.players.length - 1;

  const validation = validateBid({
    bid,
    cardsDealt: state.cardsPerPlayer,
    priorBidsSum,
    isLastPlayer,
    enableLastBidRestriction: state.enableLastBidRestriction
  });

  if (!validation.valid) {
    // If it's invalid (e.g. for bot), bot will retry with adjusted bid
    throw new Error(validation.message);
  }

  state.bids[playerId] = bid;
  const playerCount = state.players.length;
  
  if (Object.keys(state.bids).length === playerCount) {
    state.phase = "playing";
    state.currentTurn = (state.dealerIndex + 1) % playerCount;
  } else {
    state.currentTurn = (state.currentTurn + 1) % playerCount;
  }

  return state;
}

export function playCard(state, playerId, card) {
  if (state.phase !== "playing") return state;

  const activePlayer = state.players[state.currentTurn];
  if (activePlayer.id !== playerId) return state;

  const playerHand = state.hands[playerId] || [];
  const leadSuit = state.playedCards.length > 0 ? state.playedCards[0].card.suit : null;

  const validation = validateCardPlay({ card, playerHand, leadSuit });
  if (!validation.valid) throw new Error(validation.message);

  state.hands[playerId] = playerHand.filter(c => !(c.suit === card.suit && c.rank === card.rank));
  state.playedCards.push({ playerId, card });

  const playerCount = state.players.length;

  if (state.playedCards.length === playerCount) {
    state.phase = "resolvingTrick";
  } else {
    state.currentTurn = (state.currentTurn + 1) % playerCount;
  }

  return state;
}

export function resolveTrick(state) {
  if (state.phase !== "resolvingTrick") {
    return { state, winnerId: null, roundEnded: false };
  }

  const winnerPlay = determineTrickWinner({
    playedCards: state.playedCards,
    activeTrump: state.trump
  });

  const winnerId = winnerPlay.playerId;
  const winnerName = state.players.find(p => p.id === winnerId)?.name || "Bot";
  state.tricksWon[winnerId] = (state.tricksWon[winnerId] || 0) + 1;

  state.lastTrickWinner = {
    playerId: winnerId,
    playerName: winnerName,
    winningCard: winnerPlay.card,
    resolvedAt: Date.now()
  };

  const winnerIndex = state.players.findIndex(p => p.id === winnerId);
  state.currentTurn = winnerIndex;
  state.playedCards = [];

  const firstPlayerId = state.players[0].id;
  const cardsLeft = state.hands[firstPlayerId]?.length || 0;
  let roundEnded = false;

  if (cardsLeft === 0) {
    roundEnded = true;
    const roundScores = {};
    for (const p of state.players) {
      const guess = state.bids[p.id] ?? 0;
      const won = state.tricksWon[p.id] ?? 0;
      const score = calculateRoundScore({
        guess,
        won,
        scoreMode: state.scoreMode
      });
      state.scores[p.id].push(score);
      roundScores[p.id] = score;
    }

    state.roundHistory.push({
      round: state.round,
      trump: state.trump,
      bids: { ...state.bids },
      tricksWon: { ...state.tricksWon },
      scores: roundScores
    });

    state.phase = "roundEnd";
  } else {
    state.phase = "playing";
  }

  return { state, winnerId, roundEnded };
}

export function continueRound(state, playerId) {
  if (state.phase !== "roundEnd") return state;
  if (state.continueBy !== null) return state;

  state.continueBy = playerId;

  if (state.round >= state.maxRounds) {
    state.phase = "gameEnd";
  } else {
    state.round += 1;
    state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
    startRound(state);
  }

  return state;
}

// 8. BOT LOGIC (DECISION ENGINES)
export function getBotBid(hand, cardsPerPlayer, trump, priorBidsSum, isLastPlayer, enableLastBidRestriction) {
  let strength = 0;
  
  for (const card of hand) {
    // Value points
    if (card.rank === "A") strength += 1.0;
    else if (card.rank === "K") strength += 0.85;
    else if (card.rank === "Q") strength += 0.6;
    else if (card.rank === "J") strength += 0.4;
    else if (card.value >= 10) strength += 0.2;
    
    // Trump bonus
    if (card.suit === trump) {
      if (card.rank === "A" || card.rank === "K") {
        strength += 0.5; // Extra security for high trump
      } else {
        strength += 0.7; // Standard trump card strength
      }
    }
  }

  let bid = Math.round(strength);
  // Clamp to cards count
  if (bid > cardsPerPlayer) bid = cardsPerPlayer;
  if (bid < 0) bid = 0;

  // Enforce Last Player Restriction
  if (enableLastBidRestriction && isLastPlayer) {
    const forbidden = getForbiddenBidForLastPlayer(cardsPerPlayer, priorBidsSum);
    if (forbidden !== null && bid === forbidden) {
      // Adjust bid
      if (bid === 0) {
        bid = 1;
      } else {
        bid = bid - 1; // Try one less
      }
      // Re-clamp
      if (bid > cardsPerPlayer) bid = cardsPerPlayer;
      if (bid < 0) bid = 0;
      
      // If it still equals forbidden, try incrementing instead
      if (bid === forbidden) {
        bid = Math.min(cardsPerPlayer, bid + 2);
      }
    }
  }

  return bid;
}

export function getBotCardToPlay(hand, leadSuit, activeTrump, bid, tricksWon) {
  // 1. Get playable cards
  const playable = hand.filter(c => {
    try {
      const result = validateCardPlay({ card: c, playerHand: hand, leadSuit });
      return result.valid;
    } catch {
      return false;
    }
  });

  if (playable.length === 0) return hand[0]; // Fallback

  const needsTricks = tricksWon < bid;

  // Sort playable cards by value (trump counts higher)
  const rateCard = (card) => {
    let base = card.value;
    if (card.suit === activeTrump) {
      base += 20; // Trump suit is rated much higher
    }
    return base;
  };

  playable.sort((a, b) => rateCard(a) - rateCard(b)); // Ascending: index 0 is lowest, index length-1 is highest

  if (needsTricks) {
    // Play the highest card to try to win the trick
    return playable[playable.length - 1];
  } else {
    // Play the lowest card to try to lose the trick
    return playable[0];
  }
}
