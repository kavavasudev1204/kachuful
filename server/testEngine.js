// Automated validation script for the Kachuful Game Engine
import { generateDeck, shuffleDeck, dealCards } from "./gameEngine/deck.js";
import { getTrumpForRound } from "./gameEngine/trump.js";
import { validateBid } from "./gameEngine/bidding.js";
import { validateCardPlay } from "./gameEngine/validator.js";
import { determineTrickWinner } from "./gameEngine/trickWinner.js";
import { calculateRoundScore } from "./gameEngine/score.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

try {
  console.log("=== STARTING KACHUFUL ENGINE TESTS ===");

  // 1. Deck Tests
  const deck = generateDeck();
  assert(deck.length === 52, "Deck should have exactly 52 cards.");
  
  const shuffled = shuffleDeck(deck);
  assert(shuffled.length === 52, "Shuffled deck should have exactly 52 cards.");
  
  // Verify shuffle actually changed order (high probability)
  let changed = false;
  for (let i = 0; i < 10; i++) {
    if (deck[i].suit !== shuffled[i].suit || deck[i].rank !== shuffled[i].rank) {
      changed = true;
      break;
    }
  }
  assert(changed, "Shuffled deck should differ from original deck order.");

  const playerIds = ["p1", "p2", "p3"];
  const { hands, remainingDeck } = dealCards(shuffled, 5, playerIds);
  assert(hands["p1"].length === 5, "p1 should have 5 cards.");
  assert(hands["p2"].length === 5, "p2 should have 5 cards.");
  assert(hands["p3"].length === 5, "p3 should have 5 cards.");
  assert(remainingDeck.length === 52 - 15, "Remaining deck should be 37 cards.");

  // 2. Trump Rotation Tests
  assert(getTrumpForRound(1) === "SPADE", "Round 1 Trump should be SPADE.");
  assert(getTrumpForRound(2) === "HEART", "Round 2 Trump should be HEART.");
  assert(getTrumpForRound(3) === "CLUB", "Round 3 Trump should be CLUB.");
  assert(getTrumpForRound(4) === "DIAMOND", "Round 4 Trump should be DIAMOND.");
  assert(getTrumpForRound(5) === "SPADE", "Round 5 Trump should be SPADE.");

  // 3. Bid Restriction Tests
  // Non-restricted player
  const normalBid = validateBid({
    bid: 2,
    cardsDealt: 5,
    priorBidsSum: 3,
    isLastPlayer: false,
    enableLastBidRestriction: true
  });
  assert(normalBid.valid === true, "Normal player should be allowed to bid any valid amount.");

  // Last player restriction active: Round 5 (5 cards), prior bids = 1 + 2 + 1 = 4.
  // Forbidden bid for last player: 5 - 4 = 1.
  const invalidBid = validateBid({
    bid: 1,
    cardsDealt: 5,
    priorBidsSum: 4,
    isLastPlayer: true,
    enableLastBidRestriction: true
  });
  assert(invalidBid.valid === false, "Last player should NOT be allowed to make bids sum equal cards count.");
  assert(invalidBid.forbiddenBid === 1, "Forbidden bid should be calculated as 1.");

  const allowedBid = validateBid({
    bid: 2,
    cardsDealt: 5,
    priorBidsSum: 4,
    isLastPlayer: true,
    enableLastBidRestriction: true
  });
  assert(allowedBid.valid === true, "Last player bidding non-restricted amount should be allowed.");

  // Last player restriction disabled
  const disabledRestriction = validateBid({
    bid: 1,
    cardsDealt: 5,
    priorBidsSum: 4,
    isLastPlayer: true,
    enableLastBidRestriction: false
  });
  assert(disabledRestriction.valid === true, "Last player restriction can be disabled.");

  // 4. Card Play Validator Tests
  const hand = [
    { suit: "HEART", rank: "A", value: 14 },
    { suit: "HEART", rank: "2", value: 2 },
    { suit: "SPADE", rank: "10", value: 10 }
  ];

  // Try to play card not in hand
  const notOwned = validateCardPlay({
    card: { suit: "HEART", rank: "K", value: 13 },
    playerHand: hand,
    leadSuit: null
  });
  assert(notOwned.valid === false, "Cannot play a card not in hand.");

  // Lead suit is HEART. Player plays SPADE 10 (but they have HEARTS in hand).
  const violateLead = validateCardPlay({
    card: { suit: "SPADE", rank: "10", value: 10 },
    playerHand: hand,
    leadSuit: "HEART"
  });
  assert(violateLead.valid === false, "Must follow lead suit if possible.");

  // Lead suit is HEART. Player plays HEART A.
  const followLead = validateCardPlay({
    card: { suit: "HEART", rank: "A", value: 14 },
    playerHand: hand,
    leadSuit: "HEART"
  });
  assert(followLead.valid === true, "Following lead suit should be valid.");

  // Lead suit is CLUB. Player plays SPADE 10 (doesn't have CLUBS).
  const playDiscard = validateCardPlay({
    card: { suit: "SPADE", rank: "10", value: 10 },
    playerHand: hand,
    leadSuit: "CLUB"
  });
  assert(playDiscard.valid === true, "Can play any suit if player has no card of lead suit.");

  // 5. Trick Winner Tests
  // Trump: SPADE
  // Played: p1 (HEART K), p2 (HEART A), p3 (SPADE 2), p4 (HEART 10)
  const trickWithTrump = [
    { playerId: "p1", card: { suit: "HEART", rank: "K", value: 13 } },
    { playerId: "p2", card: { suit: "HEART", rank: "A", value: 14 } },
    { playerId: "p3", card: { suit: "SPADE", rank: "2", value: 2 } }, // Trump
    { playerId: "p4", card: { suit: "HEART", rank: "10", value: 10 } }
  ];
  const winner1 = determineTrickWinner({ playedCards: trickWithTrump, activeTrump: "SPADE" });
  assert(winner1.playerId === "p3", "Trump card (SPADE 2) should win over high HEARTS.");

  // No trump played. Played: p1 (HEART K), p2 (HEART A), p3 (HEART 8), p4 (HEART 10)
  const trickNoTrump = [
    { playerId: "p1", card: { suit: "HEART", rank: "K", value: 13 } },
    { playerId: "p2", card: { suit: "HEART", rank: "A", value: 14 } },
    { playerId: "p3", card: { suit: "HEART", rank: "8", value: 8 } },
    { playerId: "p4", card: { suit: "HEART", rank: "10", value: 10 } }
  ];
  const winner2 = determineTrickWinner({ playedCards: trickNoTrump, activeTrump: "SPADE" });
  assert(winner2.playerId === "p2", "Highest card of lead suit (HEART A) should win when no trump is played.");

  // 6. Score Calculation Tests
  // Mode 1: ADD_10
  assert(calculateRoundScore({ guess: 3, won: 3, scoreMode: "ADD_10" }) === 13, "ADD_10: 3 correct bids should equal 13.");
  assert(calculateRoundScore({ guess: 3, won: 2, scoreMode: "ADD_10" }) === 0, "ADD_10: incorrect bid should equal 0.");
  assert(calculateRoundScore({ guess: 0, won: 0, scoreMode: "ADD_10" }) === 10, "ADD_10: 0 correct bids should equal 10.");

  // Mode 2: MULTIPLY_10
  assert(calculateRoundScore({ guess: 3, won: 3, scoreMode: "MULTIPLY_10" }) === 30, "MULTIPLY_10: 3 correct bids should equal 30.");
  assert(calculateRoundScore({ guess: 3, won: 2, scoreMode: "MULTIPLY_10" }) === 0, "MULTIPLY_10: incorrect bid should equal 0.");
  assert(calculateRoundScore({ guess: 0, won: 0, scoreMode: "MULTIPLY_10" }) === 10, "MULTIPLY_10: 0 correct bids should equal 10 (Special).");

  console.log("=== ALL KACHUFUL ENGINE TESTS PASSED ===");
} catch (error) {
  console.error("TEST FAILED:", error.message);
  process.exit(1);
}
