import { create } from "zustand";
import { socket } from "../socket/socket";
import {
  initGame,
  placeBid,
  playCard,
  resolveTrick,
  continueRound,
  getBotBid,
  getBotCardToPlay
} from "../utils/gameEngine";
import { sounds } from "../utils/soundEffects";

const LOCAL_PLAYER_ID = "local-player";

export const useGameStore = create((set, get) => ({
  // Player Identification
  playerName: localStorage.getItem("playerName") || "",
  myPlayerId: "",
  isConnected: false,
  isOffline: false,
  
  // Room state
  roomCode: "",
  hostId: "",
  hostName: "",
  players: [],
  status: "waiting", // waiting, playing, finished
  settings: {
    scoreMode: "ADD_10",
    maxRounds: 6,
    enableLastBidRestriction: true
  },
  
  // Game state
  gameState: null,
  
  // Chat list
  chats: [],
  
  // Error handling
  errorMessage: "",
  
  // Accessibility Preference
  accessibilityMode: localStorage.getItem("accessibilityMode") === "true",

  // ACTIONS
  
  setPlayerName: (name) => {
    localStorage.setItem("playerName", name);
    set({ playerName: name });
  },
  
  toggleAccessibilityMode: () => {
    const newVal = !get().accessibilityMode;
    localStorage.setItem("accessibilityMode", String(newVal));
    set({ accessibilityMode: newVal });
  },
  
  clearError: () => set({ errorMessage: "" }),
  
  setError: (msg) => set({ errorMessage: msg }),
  
  setGameState: (gameState) => {
    set({
      gameState,
      status: "playing",
      roomCode: gameState.roomCode || get().roomCode,
      players: gameState.players || get().players
    });
  },

  // ==========================================
  // ONLINE / MULTIPLAYER ACTIONS
  // ==========================================
  
  connectSocket: () => {
    if (!socket.connected) {
      socket.connect();
      set({ isConnected: true, isOffline: false });
      
      // Register socket listeners inside store
      get().registerSocketEvents();
    }
  },

  disconnectSocket: () => {
    if (socket.connected) {
      socket.disconnect();
    }
    set({ isConnected: false, myPlayerId: "" });
  },

  registerSocketEvents: () => {
    socket.off("connect");
    socket.off("disconnect");
    socket.off("room-created");
    socket.off("player-joined");
    socket.off("player-left");
    socket.off("settings-updated");
    socket.off("game-started");
    socket.off("cards-dealt");
    socket.off("bid-placed");
    socket.off("all-bids-received");
    socket.off("card-played");
    socket.off("trick-finished");
    socket.off("round-finished");
    socket.off("scoreboard");
    socket.off("next-round-started");
    socket.off("player-disconnected");
    socket.off("player-reconnected");
    socket.off("room-closed");
    socket.off("game-finished");
    socket.off("player-name-changed");
    socket.off("chat-message");
    socket.off("error-occurred");

    socket.on("connect", () => {
      set({ myPlayerId: socket.id, isConnected: true });
    });

    socket.on("disconnect", () => {
      set({ isConnected: false });
    });

    socket.on("room-created", (room) => {
      set({
        roomCode: room.roomCode,
        hostId: room.hostId,
        hostName: room.hostName,
        status: room.status,
        players: room.players,
        settings: room.settings,
        gameState: room.gameState,
        myPlayerId: socket.id
      });
    });

    socket.on("player-joined", (room) => {
      set({
        roomCode: room.roomCode,
        players: room.players,
        settings: room.settings,
        gameState: room.gameState
      });
    });

    socket.on("player-left", ({ room }) => {
      set({
        players: room.players,
        hostId: room.hostId,
        hostName: room.hostName,
        settings: room.settings
      });
    });

    socket.on("settings-updated", (room) => {
      set({ settings: room.settings });
    });

    socket.on("game-started", (gameState) => {
      get().setGameState(gameState);
      sounds.playDeal();
    });

    socket.on("cards-dealt", (gameState) => {
      set({ gameState });
      sounds.playDeal();
    });

    socket.on("bid-placed", (gameState) => {
      set({ gameState });
      sounds.playFlip();
    });

    socket.on("all-bids-received", (gameState) => {
      set({ gameState });
    });

    socket.on("card-played", (gameState) => {
      set({ gameState });
      sounds.playDrop();
    });

    socket.on("trick-finished", ({ gameState, winnerId }) => {
      set({ gameState });
      sounds.playWinner();
    });

    socket.on("round-finished", (gameState) => {
      set({ gameState });
    });

    socket.on("scoreboard", (gameState) => {
      set({ gameState });
    });

    socket.on("next-round-started", (gameState) => {
      set({ gameState });
    });

    socket.on("player-disconnected", ({ playerId, playerName, room }) => {
      // Mark player disconnected in UI
      set({
        players: room.players,
        gameState: room.gameState // Sync re-mapped structures
      });
      // Add local notice
      get().addSystemChat(`${playerName} disconnected. They have 5 minutes to reconnect.`);
    });

    socket.on("player-reconnected", ({ room, playerId, playerName }) => {
      set({
        players: room.players,
        gameState: room.gameState,
        hostId: room.hostId
      });
      get().addSystemChat(`${playerName} reconnected to the room.`);
    });

    socket.on("room-closed", ({ message }) => {
      set({
        roomCode: "",
        players: [],
        status: "waiting",
        gameState: null,
        chats: []
      });
      set({ errorMessage: message || "Room was closed by the host." });
    });

    socket.on("game-finished", (gameState) => {
      set({
        status: "finished",
        gameState
      });
      sounds.playGameOver();
    });

    socket.on("player-name-changed", ({ room, oldName, newName }) => {
      set({
        players: room.players,
        hostName: room.hostName
      });
      get().addSystemChat(`${oldName} changed their name to ${newName}.`);
    });

    socket.on("chat-message", (msgObj) => {
      set((state) => ({ chats: [...state.chats, msgObj] }));
    });

    socket.on("error-occurred", ({ message }) => {
      set({ errorMessage: message });
    });
  },

  createRoomOnline: (name) => {
    get().connectSocket();
    // Wait for connect event to populate socket ID or just fire it
    if (socket.connected) {
      set({ myPlayerId: socket.id });
    }
    socket.emit("create-room", { name });
  },

  joinRoomOnline: (roomCode, name) => {
    get().connectSocket();
    if (socket.connected) {
      set({ myPlayerId: socket.id });
    }
    socket.emit("join-room", { roomCode, name });
  },

  changeSettingsOnline: (settings) => {
    const code = get().roomCode;
    if (code) {
      socket.emit("change-settings", { roomCode: code, settings });
    }
  },

  startGameOnline: () => {
    const code = get().roomCode;
    if (code) {
      socket.emit("start-game", { roomCode: code });
    }
  },

  placeBidOnline: (bid) => {
    const code = get().roomCode;
    if (code) {
      socket.emit("place-bid", { roomCode: code, bid });
    }
  },

  playCardOnline: (card) => {
    const code = get().roomCode;
    if (code) {
      socket.emit("play-card", { roomCode: code, card });
    }
  },

  continueRoundOnline: () => {
    const code = get().roomCode;
    if (code) {
      socket.emit("continue-round", { roomCode: code });
    }
  },

  leaveRoomOnline: () => {
    const code = get().roomCode;
    if (code) {
      socket.emit("leave-room", { roomCode: code });
    }
    get().disconnectSocket();
    set({
      roomCode: "",
      players: [],
      status: "waiting",
      gameState: null,
      chats: []
    });
  },

  sendChatOnline: (message) => {
    const code = get().roomCode;
    if (code) {
      socket.emit("send-chat", { roomCode: code, message });
    }
  },

  changeNameOnline: (newName) => {
    const code = get().roomCode;
    if (code) {
      socket.emit("change-name", { roomCode: code, newName });
    }
  },

  addSystemChat: (message) => {
    const sysMsg = {
      sender: "System",
      senderId: "system",
      message,
      timestamp: new Date().toLocaleTimeString()
    };
    set((state) => ({ chats: [...state.chats, sysMsg] }));
  },

  // ==========================================
  // OFFLINE / BOT SIMULATION ACTIONS
  // ==========================================
  
  startOfflineGame: (name, botCount, config = {}) => {
    const playerName = name.trim() || "Vasudev";
    
    // Setup local offline room
    const roomCode = "OFFLINE";
    const hostId = LOCAL_PLAYER_ID;
    
    const players = [
      { id: hostId, name: playerName, isHost: true, isBot: false, connected: true }
    ];
    
    for (let i = 1; i <= botCount; i++) {
      players.push({
        id: `bot_${i}`,
        name: `BOT ${i}`,
        isHost: false,
        isBot: true,
        connected: true
      });
    }

    const settings = {
      scoreMode: config.scoreMode || "ADD_10",
      maxRounds: config.maxRounds || Math.floor(52 / players.length),
      enableLastBidRestriction: config.enableLastBidRestriction !== false
    };

    const initialGameState = initGame(players, settings);

    set({
      isOffline: true,
      myPlayerId: hostId,
      roomCode,
      hostId,
      hostName: playerName,
      status: "playing",
      players,
      settings,
      gameState: initialGameState,
      chats: [],
      errorMessage: ""
    });

    get().addSystemChat("Offline mode started. Bots are ready!");
    sounds.playDeal();
    
    // Check if the first turn is a bot and run bot cycle
    get().runBotBiddingCycle();
  },

  placeBidOffline: (bid) => {
    try {
      const state = get().gameState;
      if (!state) return;

      const updated = placeBid({ ...state }, LOCAL_PLAYER_ID, bid);
      set({ gameState: updated });

      if (updated.phase === "playing") {
        get().addSystemChat("All bids received! Let's play cards.");
        // Bidding ended, check who plays card first (could be bot)
        get().runBotPlayCycle();
      } else {
        // Next bidding turn
        get().runBotBiddingCycle();
      }
    } catch (err) {
      set({ errorMessage: err.message });
    }
  },

  playCardOffline: (card) => {
    try {
      const state = get().gameState;
      if (!state) return;

      const updated = playCard({ ...state }, LOCAL_PLAYER_ID, card);
      set({ gameState: updated });
      sounds.playDrop();

      if (updated.phase === "resolvingTrick") {
        get().resolveTrickOffline();
      } else {
        // Next play turn
        get().runBotPlayCycle();
      }
    } catch (err) {
      set({ errorMessage: err.message });
    }
  },

  resolveTrickOffline: () => {
    // 2 seconds delay to let user see cards on table
    setTimeout(() => {
      const state = get().gameState;
      if (!state || state.phase !== "resolvingTrick") return;

      const { state: updated, winnerId, roundEnded } = resolveTrick({ ...state });
      
      const winnerName = get().players.find(p => p.id === winnerId)?.name || "Unknown";
      get().addSystemChat(`${winnerName} wins the trick!`);
      
      set({ gameState: updated });
      sounds.playWinner();

      if (roundEnded) {
        if (updated.phase === "gameEnd") {
          set({ status: "finished" });
          get().addSystemChat("Game finished! Inspect the results.");
        } else {
          get().addSystemChat(`Round ${updated.round - 1} finished. Scoreboard open.`);
        }
      } else {
        // Next trick, starts with winner (could be bot)
        get().runBotPlayCycle();
      }
    }, 2000);
  },

  continueRoundOffline: () => {
    const state = get().gameState;
    if (!state || state.phase !== "roundEnd") return;

    const updated = continueRound({ ...state }, LOCAL_PLAYER_ID);
    
    set({ gameState: updated });
    
    if (updated.phase === "gameEnd") {
      set({ status: "finished" });
      sounds.playGameOver();
    } else {
      get().addSystemChat(`Round ${updated.round} started! Deal cards.`);
      sounds.playDeal();
      // Run bot bid cycle for new round
      get().runBotBiddingCycle();
    }
  },

  leaveRoomOffline: () => {
    set({
      isOffline: false,
      roomCode: "",
      players: [],
      status: "waiting",
      gameState: null,
      chats: []
    });
  },

  sendChatOffline: (message) => {
    const msgObj = {
      sender: get().hostName,
      senderId: LOCAL_PLAYER_ID,
      message,
      timestamp: new Date().toLocaleTimeString()
    };
    set((state) => ({ chats: [...state.chats, msgObj] }));

    // Simulating bot reactions for offline chats (just for fun & feedback!)
    setTimeout(() => {
      if (get().isOffline) {
        const randomBot = get().players.find(p => p.isBot);
        if (randomBot) {
          const botResponses = [
            "Good luck!",
            "Nice play!",
            "Let's see who wins this round.",
            "I'm confident in my bid!",
            "Good game so far!"
          ];
          const resp = botResponses[Math.floor(Math.random() * botResponses.length)];
          set((state) => ({
            chats: [
              ...state.chats,
              {
                sender: randomBot.name,
                senderId: randomBot.id,
                message: resp,
                timestamp: new Date().toLocaleTimeString()
              }
            ]
          }));
        }
      }
    }, 1000);
  },

  // BOT CYCLES RUNNERS
  runBotBiddingCycle: () => {
    // Small timeout for bot action spacing
    setTimeout(() => {
      const state = get().gameState;
      if (!state || state.phase !== "bidding" || !get().isOffline) return;

      const activePlayer = state.players[state.currentTurn];
      if (!activePlayer || !activePlayer.isBot) return;

      const botId = activePlayer.id;
      const hand = state.hands[botId];
      const priorBidsSum = Object.values(state.bids).reduce((sum, v) => sum + v, 0);
      const bidsCount = Object.keys(state.bids).length;
      const isLastPlayer = bidsCount === state.players.length - 1;
      
      const bid = getBotBid(
        hand,
        state.cardsPerPlayer,
        state.trump,
        priorBidsSum,
        isLastPlayer,
        state.enableLastBidRestriction && state.round === 1
      );

      try {
        const updated = placeBid({ ...state }, botId, bid);
        set({ gameState: updated });
        
        get().addSystemChat(`${activePlayer.name} bids ${bid}.`);

        if (updated.phase === "playing") {
          get().addSystemChat("All bids received! Let's play cards.");
          get().runBotPlayCycle();
        } else {
          // Recursively trigger next bot bid if it's a bot's turn
          get().runBotBiddingCycle();
        }
      } catch (err) {
        console.error(`[Offline Bot Error] Bidding failed: ${err.message}`);
      }
    }, 800);
  },

  runBotPlayCycle: () => {
    setTimeout(() => {
      const state = get().gameState;
      if (!state || state.phase !== "playing" || !get().isOffline) return;

      const activePlayer = state.players[state.currentTurn];
      if (!activePlayer || !activePlayer.isBot) return;

      const botId = activePlayer.id;
      const hand = state.hands[botId];
      const leadCard = state.playedCards[0]?.card;
      const leadSuit = leadCard ? leadCard.suit : null;
      const bid = state.bids[botId];
      const tricksWon = state.tricksWon[botId] || 0;
      
      const card = getBotCardToPlay(
        hand,
        leadSuit,
        state.trump,
        bid,
        tricksWon
      );

      try {
        const updated = playCard({ ...state }, botId, card);
        set({ gameState: updated });
        sounds.playDrop();
        
        get().addSystemChat(`${activePlayer.name} plays ${card.rank} of ${card.suit}.`);

        if (updated.phase === "resolvingTrick") {
          get().resolveTrickOffline();
        } else {
          // Recursively trigger next bot play
          get().runBotPlayCycle();
        }
      } catch (err) {
        console.error(`[Offline Bot Error] Playing failed: ${err.message}`);
      }
    }, 800);
  }
}));
