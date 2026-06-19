import { generateDeck, shuffleDeck, dealCards } from "./deck.js";
import { getTrumpForRound } from "./trump.js";
import { validateBid } from "./bidding.js";
import { validateCardPlay } from "./validator.js";
import { determineTrickWinner } from "./trickWinner.js";
import { calculateRoundScore } from "./score.js";

// Helper to calculate maximum allowed rounds
export function getMaxAllowedRounds(playerCount) {
  if (playerCount <= 0) return 13;
  return Math.floor(52 / playerCount);
}

// Initial game state setup
export function initGame(players, config = {}) {
  const scoreMode = config.scoreMode || "ADD_10";
  const enableLastBidRestriction = config.enableLastBidRestriction !== false;
  
  const maxRounds = config.maxRounds || getMaxAllowedRounds(players.length);
  
  const scores = {};
  for (const p of players) {
    scores[p.id] = [];
  }

  const state = {
    phase: "bidding", // waiting, bidding, playing, roundEnd, gameEnd
    round: 1,
    maxRounds,
    cardsPerPlayer: 1,
    dealerIndex: 0,
    currentTurn: 0, // starts with player next to dealer (left)
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
    // Store players reference for indexing
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot || false
    }))
  };

  return startRound(state);
}

// Internal helper to start/reset a round
export function startRound(state) {
  const playerCount = state.players.length;
  state.cardsPerPlayer = state.round;
  state.trump = getTrumpForRound(state.round);
  
  // Create and deal deck
  const deck = shuffleDeck(generateDeck());
  const { hands, remainingDeck } = dealCards(deck, state.cardsPerPlayer, state.players.map(p => p.id));
  
  state.deck = remainingDeck;
  state.hands = hands;
  state.bids = {};
  state.playedCards = [];
  state.continueBy = null;
  state.lastTrickWinner = null;
  state.phase = "bidding";
  
  // Reset tricks won for this round
  state.tricksWon = {};
  for (const p of state.players) {
    state.tricksWon[p.id] = 0;
  }
  
  // Turn starts with player to the left of the dealer
  state.currentTurn = (state.dealerIndex + 1) % playerCount;

  return state;
}

// Place a bid
export function placeBid(state, playerId, bid) {
  if (state.phase !== "bidding") {
    throw new Error("Not in bidding phase.");
  }

  const activePlayer = state.players[state.currentTurn];
  if (activePlayer.id !== playerId) {
    throw new Error("It is not your turn to bid.");
  }

  // Calculate prior bids sum
  const priorBidsSum = Object.values(state.bids).reduce((sum, val) => sum + val, 0);
  
  // Check if this is the last player
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
    throw new Error(validation.message);
  }

  // Save the bid
  state.bids[playerId] = bid;

  // Move to next player
  const playerCount = state.players.length;
  
  if (Object.keys(state.bids).length === playerCount) {
    // Bidding complete, move to playing
    state.phase = "playing";
    // First player to play cards is also the player next to the dealer
    state.currentTurn = (state.dealerIndex + 1) % playerCount;
  } else {
    state.currentTurn = (state.currentTurn + 1) % playerCount;
  }

  return state;
}

// Play a card
export function playCard(state, playerId, card) {
  if (state.phase !== "playing") {
    throw new Error("Not in playing phase.");
  }

  const activePlayer = state.players[state.currentTurn];
  if (activePlayer.id !== playerId) {
    throw new Error("It is not your turn to play.");
  }

  const playerHand = state.hands[playerId] || [];
  const leadSuit = state.playedCards.length > 0 ? state.playedCards[0].card.suit : null;

  const validation = validateCardPlay({
    card,
    playerHand,
    leadSuit
  });

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  // Remove card from hand
  state.hands[playerId] = playerHand.filter(
    c => !(c.suit === card.suit && c.rank === card.rank)
  );

  // Play card to table
  state.playedCards.push({
    playerId,
    card
  });

  const playerCount = state.players.length;

  // Check if trick is finished (all players played a card)
  if (state.playedCards.length === playerCount) {
    // Transition phase to lock play while trick is resolving
    state.phase = "resolvingTrick";
  } else {
    // Next player's turn to play
    state.currentTurn = (state.currentTurn + 1) % playerCount;
  }

  return state;
}

// Resolves the current trick: determines winner, updates counts, and handles round-end transition
export function resolveTrick(state) {
  if (state.phase !== "resolvingTrick") {
    return { state, winnerId: null, roundEnded: false };
  }

  // Determine trick winner
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

  // The trick winner starts the next trick
  const winnerIndex = state.players.findIndex(p => p.id === winnerId);
  state.currentTurn = winnerIndex;
  
  // Clear the table
  state.playedCards = [];

  // Check if the round is finished (no cards left in hands)
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
    // Resume playing phase for the next trick
    state.phase = "playing";
  }

  return { state, winnerId, roundEnded };
}

// Move to next round
export function continueRound(state, playerId) {
  if (state.phase !== "roundEnd") {
    throw new Error("Cannot continue: Round has not ended.");
  }

  // Accept only the first continue click
  if (state.continueBy !== null) {
    return state; // Already continuing
  }

  state.continueBy = playerId;

  if (state.round >= state.maxRounds) {
    state.phase = "gameEnd";
  } else {
    state.round += 1;
    // Rotate dealer index
    state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
    startRound(state);
  }

  return state;
}

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
    const forbidden = cardsPerPlayer - priorBidsSum;
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
  // Get playable cards
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

  playable.sort((a, b) => rateCard(a) - rateCard(b)); // Ascending

  if (needsTricks) {
    // Play the highest card to try to win the trick
    return playable[playable.length - 1];
  } else {
    // Play the lowest card to try to lose the trick
    return playable[0];
  }
}
