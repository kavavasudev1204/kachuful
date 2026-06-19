// Headless Kachuful Game Loop Simulator
// Simulates complete games for different player counts (2 to 6) to verify stability and correctness.

import {
  initGame,
  placeBid,
  playCard,
  resolveTrick,
  continueRound,
  getBotBid,
  getBotCardToPlay
} from "./gameEngine.js";

function runSimulation(playerCount) {
  console.log(`\n======================================================`);
  console.log(`STARTING SIMULATION FOR ${playerCount} PLAYERS`);
  console.log(`======================================================`);

  // Setup players list
  const players = [];
  for (let i = 1; i <= playerCount; i++) {
    players.push({
      id: `player_${i}`,
      name: `Player ${i}`,
      isBot: true,
      isHost: i === 1,
      connected: true
    });
  }

  const maxRounds = Math.floor(52 / playerCount);
  const config = {
    scoreMode: "ADD_10",
    maxRounds,
    enableLastBidRestriction: true
  };

  // Initialize Game State
  let state = initGame(players, config);
  console.log(`[Init] Game initialized with max rounds: ${maxRounds}`);

  // Loop through all rounds
  while (state.phase !== "gameEnd") {
    const currentRound = state.round;
    const cardsDealt = state.cardsPerPlayer;
    console.log(`\n--- Round ${currentRound} (Dealing ${cardsDealt} cards) ---`);

    // 1. BIDDING PHASE
    while (state.phase === "bidding") {
      const activePlayer = state.players[state.currentTurn];
      const botId = activePlayer.id;
      const hand = state.hands[botId];
      const priorBidsSum = Object.values(state.bids).reduce((sum, v) => sum + v, 0);
      const bidsCount = Object.keys(state.bids).length;
      const isLastPlayer = bidsCount === state.players.length - 1;
      
      const bid = getBotBid(
        hand,
        cardsDealt,
        state.trump,
        priorBidsSum,
        isLastPlayer,
        state.enableLastBidRestriction
      );

      // Verify forbidden bid isn't made
      if (state.enableLastBidRestriction && isLastPlayer) {
        const forbidden = cardsDealt - priorBidsSum;
        if (forbidden >= 0 && bid === forbidden) {
          throw new Error(`[CRITICAL] Last player ${activePlayer.name} bid forbidden value ${forbidden}!`);
        }
      }

      state = placeBid({ ...state }, botId, bid);
      console.log(`[Bidding] ${activePlayer.name} bids ${bid}. (Prior bids sum: ${priorBidsSum})`);
    }

    console.log(`[Bids Summary]`, state.bids);

    // 2. PLAYING PHASE (Cards are played until hand is empty)
    let trickCount = 0;
    while (state.phase === "playing" || state.phase === "resolvingTrick") {
      if (state.phase === "playing") {
        const activePlayer = state.players[state.currentTurn];
        const botId = activePlayer.id;
        const hand = state.hands[botId];
        const leadCard = state.playedCards[0]?.card;
        const leadSuit = leadCard ? leadCard.suit : null;
        const bid = state.bids[botId];
        const tricks = state.tricksWon[botId] || 0;

        const card = getBotCardToPlay(
          hand,
          leadSuit,
          state.trump,
          bid,
          tricks
        );

        state = playCard({ ...state }, botId, card);
        console.log(`[Play] ${activePlayer.name} plays ${card.rank} of ${card.suit}.`);
      }

      // 3. TRICK RESOLUTION (Instantly resolve trick in headless simulation)
      if (state.phase === "resolvingTrick") {
        trickCount++;
        const { state: resolvedState, winnerId, roundEnded } = resolveTrick({ ...state });
        state = resolvedState;
        
        const winnerName = state.players.find(p => p.id === winnerId).name;
        console.log(`[Trick Done] Trick ${trickCount} won by: ${winnerName} with card: ${state.lastTrickWinner.winningCard.rank} of ${state.lastTrickWinner.winningCard.suit}`);

        if (roundEnded) {
          console.log(`[Round Done] Round ${currentRound} ends.`);
          break;
        }
      }
    }

    // 4. ROUND SCOREBOARD & CONTINUE
    if (state.phase === "roundEnd") {
      console.log(`[Scoreboard Round ${currentRound}]`);
      for (const p of state.players) {
        const bid = state.bids[p.id];
        const won = state.tricksWon[p.id];
        const scoresList = state.scores[p.id];
        const lastScore = scoresList[scoresList.length - 1];
        const totalScore = scoresList.reduce((sum, v) => sum + v, 0);
        console.log(`  - ${p.name}: Bid ${bid}, Won ${won} -> Scored +${lastScore} (Total: ${totalScore})`);
      }

      // Proceed to next round
      const firstPlayerId = state.players[0].id;
      state = continueRound({ ...state }, firstPlayerId);
    }
  }

  console.log(`\n======================================================`);
  console.log(`GAME ENDED SUCCESSFULLY FOR ${playerCount} PLAYERS`);
  console.log(`======================================================`);
  
  // Print final winner
  const totals = {};
  let maxScore = -1;
  let winner = "";
  for (const p of state.players) {
    const total = state.scores[p.id].reduce((sum, v) => sum + v, 0);
    totals[p.name] = total;
    if (total > maxScore) {
      maxScore = total;
      winner = p.name;
    }
  }
  console.log("Final Scores:", totals);
  console.log(`🏆 WINNER IS: ${winner} with ${maxScore} points! 🏆\n`);
}

try {
  console.log("Starting Kachuful Complete Game Simulations (2-6 Players)...");
  
  runSimulation(2);
  runSimulation(3);
  runSimulation(4);
  runSimulation(5);
  runSimulation(6);
  
  console.log("✨ ALL MULTI-PLAYER SIMULATIONS COMPLETED SUCCESSFULLY WITH ZERO ERRORS! ✨");
} catch (err) {
  console.error("❌ SIMULATION FAILED WITH ERROR:", err);
  process.exit(1);
}
