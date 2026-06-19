import {
  createRoom,
  getRoom,
  joinRoom,
  removePlayerFromRoom,
  changeRoomSettings,
  startGame,
  handlePlayerDisconnect,
  handlePlayerReconnect
} from "../controllers/roomController.js";
import {
  resolveTrick,
  continueRound,
  placeBid,
  playCard,
  getBotBid,
  getBotCardToPlay
} from "../gameEngine/gameManager.js";

// Helper to serialize GameState for a specific player (hiding opponents' private info)
function serializeGameStateForPlayer(gameState, playerId) {
  if (!gameState) return null;

  // Shallow clone the main gameState structure
  const serialized = { ...gameState };

  // Clone players array
  if (gameState.players) {
    serialized.players = gameState.players.map(p => ({ ...p }));
  }

  // Sanitize hands: only show the card details for the requesting player
  if (gameState.hands) {
    const sanitizedHands = {};
    Object.keys(gameState.hands).forEach(pId => {
      if (pId === playerId) {
        sanitizedHands[pId] = gameState.hands[pId];
      } else {
        // Send dummy card representations to preserve the length but hide ranks/suits
        sanitizedHands[pId] = (gameState.hands[pId] || []).map(() => ({
          suit: "HIDDEN",
          rank: "HIDDEN",
          isHidden: true
        }));
      }
    });
    serialized.hands = sanitizedHands;
  }

  // Sanitize bids: hide opponent bids during the bidding phase
  if (gameState.phase === "bidding" && gameState.bids) {
    const sanitizedBids = {};
    Object.keys(gameState.bids).forEach(pId => {
      if (pId === playerId) {
        sanitizedBids[pId] = gameState.bids[pId];
      } else {
        // Set to true as a flag indicating a bid has been placed, but hide the number
        sanitizedBids[pId] = true;
      }
    });
    serialized.bids = sanitizedBids;

    // Calculate forbiddenBid for the requesting player if it is their turn to bid
    const activePlayer = gameState.players && gameState.players[gameState.currentTurn];
    if (activePlayer && activePlayer.id === playerId) {
      const priorBidsSum = Object.values(gameState.bids).reduce((sum, val) => sum + val, 0);
      const bidsCount = Object.keys(gameState.bids).length;
      const isLastPlayer = bidsCount === gameState.players.length - 1;
      if (isLastPlayer && gameState.enableLastBidRestriction) {
        serialized.forbiddenBid = gameState.cardsPerPlayer - priorBidsSum;
      } else {
        serialized.forbiddenBid = null;
      }
    } else {
      serialized.forbiddenBid = null;
    }
  } else {
    // If not in bidding phase, bids are public
    if (gameState.bids) {
      serialized.bids = { ...gameState.bids };
    }
    serialized.forbiddenBid = null;
  }

  // Clone scores and tricksWon
  if (gameState.scores) {
    serialized.scores = { ...gameState.scores };
  }
  if (gameState.tricksWon) {
    serialized.tricksWon = { ...gameState.tricksWon };
  }

  return serialized;
}

// Helper to serialize Room for a specific player
function serializeRoomForPlayer(room, playerId) {
  if (!room) return null;
  const gs = room.gameState ? serializeGameStateForPlayer(room.gameState, playerId) : null;
  const dealerPlayer = gs && gs.players && gs.dealerIndex !== undefined ? gs.players[gs.dealerIndex] : null;

  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    hostName: room.hostName,
    status: room.status,
    isPublic: room.isPublic,
    settings: room.settings,
    players: room.players || [],
    gameState: gs,
    
    // Flattened properties for compatibility/verification
    hands: gs ? gs.hands : {},
    scores: gs ? gs.scores : (room.gameState?.scores || {}),
    bids: gs ? gs.bids : {},
    trump: gs ? gs.trump : null,
    round: gs ? gs.round : 1,
    dealer: dealerPlayer || null,
    phase: gs ? gs.phase : (room.status || "waiting")
  };
}

// Helper to broadcast personalized events to all players in a room
function broadcastToRoom(io, roomCode, event, payloadMaker) {
  const room = getRoom(roomCode);
  if (!room) return;
  room.players.forEach(p => {
    const s = io.sockets.sockets.get(p.id);
    if (s) {
      const data = typeof payloadMaker === "function" ? payloadMaker(p.id) : payloadMaker;
      s.emit(event, data);
    }
  });
}

// Check and process turns for bots or disconnected players
function checkAndProcessOfflineTurns(io, room) {
  if (!room || !room.gameState || room.status !== "playing") return;
  const gameState = room.gameState;
  if (gameState.phase !== "bidding" && gameState.phase !== "playing") return;

  const activePlayerIndex = gameState.currentTurn;
  const activePlayer = gameState.players[activePlayerIndex];
  if (!activePlayer) return;

  const roomPlayer = room.players.find(p => p.id === activePlayer.id);
  const isBotOrDisconnected = activePlayer.isBot || (roomPlayer && !roomPlayer.connected);

  if (isBotOrDisconnected) {
    if (process.env.DEBUG === "true") {
      console.log(`[Socket] Auto-playing turn for ${activePlayer.name} (isBot: ${activePlayer.isBot}, disconnected: ${roomPlayer ? !roomPlayer.connected : true})`);
    }
    
    if (gameState.phase === "bidding") {
      const hand = gameState.hands[activePlayer.id] || [];
      const priorBidsSum = Object.values(gameState.bids).reduce((sum, v) => sum + v, 0);
      const bidsCount = Object.keys(gameState.bids).length;
      const isLastPlayer = bidsCount === gameState.players.length - 1;
      
      const bid = getBotBid(
        hand,
        gameState.cardsPerPlayer,
        gameState.trump,
        priorBidsSum,
        isLastPlayer,
        gameState.enableLastBidRestriction
      );

      try {
        room.gameState = placeBid(gameState, activePlayer.id, bid);
        
        if (room.gameState.phase === "playing") {
          broadcastToRoom(io, room.roomCode, "all-bids-received", (pId) => serializeGameStateForPlayer(room.gameState, pId));
        } else {
          broadcastToRoom(io, room.roomCode, "bid-placed", (pId) => serializeGameStateForPlayer(room.gameState, pId));
        }

        // Recursively check next player turn
        setTimeout(() => checkAndProcessOfflineTurns(io, room), 500);
      } catch (err) {
        console.error(`[Socket Error] Auto-bid failed for ${activePlayer.name}: ${err.message}`);
      }

    } else if (gameState.phase === "playing") {
      const hand = gameState.hands[activePlayer.id] || [];
      const leadCard = gameState.playedCards[0]?.card;
      const leadSuit = leadCard ? leadCard.suit : null;
      const bid = gameState.bids[activePlayer.id] || 0;
      const tricks = gameState.tricksWon[activePlayer.id] || 0;
      
      const card = getBotCardToPlay(
        hand,
        leadSuit,
        gameState.trump,
        bid,
        tricks
      );

      try {
        room.gameState = playCard(gameState, activePlayer.id, card);
        broadcastToRoom(io, room.roomCode, "card-played", (pId) => serializeGameStateForPlayer(room.gameState, pId));

        if (room.gameState.phase === "resolvingTrick") {
          // Pause 2 seconds so all players can see the completed trick
          setTimeout(() => {
            try {
              const currentRoom = getRoom(room.roomCode);
              if (!currentRoom || !currentRoom.gameState) return;
              
              const { winnerId, roundEnded } = resolveTrick(currentRoom.gameState);
              
              if (roundEnded) {
                if (currentRoom.gameState.phase === "gameEnd") {
                  currentRoom.status = "finished";
                  io.to(currentRoom.roomCode).emit("game-finished", currentRoom.gameState);
                } else {
                  broadcastToRoom(io, currentRoom.roomCode, "round-finished", (pId) => serializeGameStateForPlayer(currentRoom.gameState, pId));
                  broadcastToRoom(io, currentRoom.roomCode, "scoreboard", (pId) => serializeGameStateForPlayer(currentRoom.gameState, pId));
                }
              } else {
                broadcastToRoom(io, currentRoom.roomCode, "trick-finished", (pId) => ({
                  gameState: serializeGameStateForPlayer(currentRoom.gameState, pId),
                  winnerId
                }));
                // Check next turn after trick resolution
                setTimeout(() => checkAndProcessOfflineTurns(io, currentRoom), 500);
              }
            } catch (err) {
              console.error(`[Socket Error] Error resolving trick in auto-play: ${err.message}`);
            }
          }, 2000);
        } else {
          // Recursively check next player turn
          setTimeout(() => checkAndProcessOfflineTurns(io, room), 500);
        }
      } catch (err) {
        console.error(`[Socket Error] Auto-play card failed for ${activePlayer.name}: ${err.message}`);
      }
    }
  }
}

export default function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    if (process.env.DEBUG === "true") {
      console.log(`[Socket] Client connected: ${socket.id}`);
    }

    // Helper to send error response safely
    const sendError = (event, message) => {
      socket.emit("error-occurred", { event, message });
    };

    // 1. CREATE ROOM
    socket.on("create-room", ({ name }) => {
      try {
        if (!name || name.trim() === "") {
          return sendError("create-room", "Player name is required.");
        }
        const room = createRoom(socket.id, name.trim());
        socket.join(room.roomCode);
        socket.emit("room-created", serializeRoomForPlayer(room, socket.id));
      } catch (err) {
        sendError("create-room", err.message);
      }
    });

    // 2. JOIN ROOM
    socket.on("join-room", ({ roomCode, name }) => {
      try {
        if (!roomCode || roomCode.trim() === "") {
          return sendError("join-room", "Room code is required.");
        }
        if (!name || name.trim() === "") {
          return sendError("join-room", "Player name is required.");
        }
        
        const code = roomCode.trim().toUpperCase();
        const existingRoom = getRoom(code);
        
        if (!existingRoom) {
          return sendError("join-room", "Room not found.");
        }

        // Check if this is a reconnection
        const playerInRoom = existingRoom.players.find(
          (p) => p.name.toLowerCase() === name.trim().toLowerCase()
        );

        if (playerInRoom) {
          // Reconnection flow (updates socket ID and maps game state)
          const room = handlePlayerReconnect(code, name.trim(), socket.id);
          socket.join(code);
          
          broadcastToRoom(io, code, "player-reconnected", (pId) => ({
            room: serializeRoomForPlayer(room, pId),
            playerId: socket.id,
            playerName: name.trim()
          }));
          broadcastToRoom(io, code, "room-updated", (pId) => serializeRoomForPlayer(room, pId));
          
          // Trigger turn check in case they disconnected during their turn
          checkAndProcessOfflineTurns(io, room);
        } else {
          // Normal join flow
          const room = joinRoom(code, socket.id, name.trim());
          socket.join(code);
          
          broadcastToRoom(io, code, "player-joined", (pId) => serializeRoomForPlayer(room, pId));
          broadcastToRoom(io, code, "room-updated", (pId) => serializeRoomForPlayer(room, pId));
        }
      } catch (err) {
        sendError("join-room", err.message);
      }
    });

    // 3. CHANGE SETTINGS
    socket.on("change-settings", ({ roomCode, settings }) => {
      try {
        const room = changeRoomSettings(roomCode, socket.id, settings);
        broadcastToRoom(io, roomCode, "settings-updated", (pId) => serializeRoomForPlayer(room, pId));
        broadcastToRoom(io, roomCode, "room-updated", (pId) => serializeRoomForPlayer(room, pId));
      } catch (err) {
        sendError("change-settings", err.message);
      }
    });

    // 4. START GAME
    socket.on("start-game", ({ roomCode }) => {
      try {
        const room = startGame(roomCode, socket.id);
        const codeUpper = room.roomCode.toUpperCase();
        
        broadcastToRoom(io, codeUpper, "game-started", (pId) => serializeGameStateForPlayer(room.gameState, pId));
        broadcastToRoom(io, codeUpper, "cards-dealt", (pId) => serializeGameStateForPlayer(room.gameState, pId));
        broadcastToRoom(io, codeUpper, "room-updated", (pId) => serializeRoomForPlayer(room, pId));
        
        checkAndProcessOfflineTurns(io, room);
      } catch (err) {
        sendError("start-game", err.message);
      }
    });

    // 5. PLACE BID
    socket.on("place-bid", ({ roomCode, bid }) => {
      try {
        const room = getRoom(roomCode);
        if (!room) return sendError("place-bid", "Room not found.");
        
        room.gameState = placeBid(room.gameState, socket.id, bid);

        if (room.gameState.phase === "playing") {
          broadcastToRoom(io, room.roomCode, "all-bids-received", (pId) => serializeGameStateForPlayer(room.gameState, pId));
        } else {
          broadcastToRoom(io, room.roomCode, "bid-placed", (pId) => serializeGameStateForPlayer(room.gameState, pId));
        }

        checkAndProcessOfflineTurns(io, room);
      } catch (err) {
        sendError("place-bid", err.message);
      }
    });

    // 6. PLAY CARD
    socket.on("play-card", ({ roomCode, card }) => {
      try {
        const room = getRoom(roomCode);
        if (!room) return sendError("play-card", "Room not found.");
        
        room.gameState = playCard(room.gameState, socket.id, card);
        
        broadcastToRoom(io, room.roomCode, "card-played", (pId) => serializeGameStateForPlayer(room.gameState, pId));

        // Check if trick needs resolution
        if (room.gameState.phase === "resolvingTrick") {
          setTimeout(() => {
            try {
              const currentRoom = getRoom(roomCode);
              if (!currentRoom || !currentRoom.gameState) return;
              
              const { winnerId, roundEnded } = resolveTrick(currentRoom.gameState);
              
              if (roundEnded) {
                if (currentRoom.gameState.phase === "gameEnd") {
                  currentRoom.status = "finished";
                  io.to(currentRoom.roomCode).emit("game-finished", currentRoom.gameState);
                } else {
                  broadcastToRoom(io, currentRoom.roomCode, "round-finished", (pId) => serializeGameStateForPlayer(currentRoom.gameState, pId));
                  broadcastToRoom(io, currentRoom.roomCode, "scoreboard", (pId) => serializeGameStateForPlayer(currentRoom.gameState, pId));
                }
              } else {
                broadcastToRoom(io, currentRoom.roomCode, "trick-finished", (pId) => ({
                  gameState: serializeGameStateForPlayer(currentRoom.gameState, pId),
                  winnerId
                }));
                checkAndProcessOfflineTurns(io, currentRoom);
              }
            } catch (err) {
              console.error(`[Socket Error] Error resolving trick: ${err.message}`);
            }
          }, 2000);
        } else {
          checkAndProcessOfflineTurns(io, room);
        }
      } catch (err) {
        sendError("play-card", err.message);
      }
    });

    // 7. CONTINUE ROUND (Start Next Round)
    socket.on("continue-round", ({ roomCode }) => {
      try {
        const room = getRoom(roomCode);
        if (!room) return sendError("continue-round", "Room not found.");
        
        room.gameState = continueRound(room.gameState, socket.id);

        if (room.gameState.phase === "gameEnd") {
          room.status = "finished";
          io.to(room.roomCode).emit("game-finished", room.gameState);
        } else {
          broadcastToRoom(io, room.roomCode, "next-round-started", (pId) => serializeGameStateForPlayer(room.gameState, pId));
          broadcastToRoom(io, room.roomCode, "cards-dealt", (pId) => serializeGameStateForPlayer(room.gameState, pId));
        }

        checkAndProcessOfflineTurns(io, room);
      } catch (err) {
        sendError("continue-round", err.message);
      }
    });

    // 8. LEAVE ROOM / KICK PLAYER
    socket.on("leave-room", ({ roomCode, targetPlayerId }) => {
      try {
        const code = roomCode.toUpperCase();
        const room = getRoom(code);
        if (!room) return sendError("leave-room", "Room not found.");

        let playerToRemoveId = socket.id;

        if (targetPlayerId && targetPlayerId !== socket.id) {
          if (room.hostId !== socket.id) {
            return sendError("leave-room", "Only the host can kick players.");
          }
          playerToRemoveId = targetPlayerId;
        }

        const updatedRoom = removePlayerFromRoom(code, playerToRemoveId);
        
        const targetSocket = io.sockets.sockets.get(playerToRemoveId);
        if (targetSocket) {
          targetSocket.leave(code);
          if (playerToRemoveId !== socket.id) {
            targetSocket.emit("room-closed", { message: "You have been kicked from the room." });
          }
        }
        
        if (updatedRoom) {
          broadcastToRoom(io, code, "player-left", (pId) => ({
            room: serializeRoomForPlayer(updatedRoom, pId),
            playerId: playerToRemoveId
          }));
          broadcastToRoom(io, code, "room-updated", (pId) => serializeRoomForPlayer(updatedRoom, pId));
        } else {
          io.to(code).emit("room-closed", { message: "Room closed. Host left or all players disconnected." });
        }
      } catch (err) {
        sendError("leave-room", err.message);
      }
    });

    // 8.5 GET ROOM STATE
    socket.on("get-room-state", (payload) => {
      try {
        let code = "";
        if (typeof payload === "string") {
          code = payload;
        } else if (payload && payload.roomCode) {
          code = payload.roomCode;
        }
        if (!code) return sendError("get-room-state", "Room code is required.");
        
        const cleanCode = code.trim().toUpperCase();
        const room = getRoom(cleanCode);
        socket.emit("room-state", serializeRoomForPlayer(room, socket.id));
      } catch (err) {
        sendError("get-room-state", err.message);
      }
    });

    // 9. CHANGE NAME (lobby option)
    socket.on("change-name", ({ roomCode, newName }) => {
      try {
        if (!newName || newName.trim() === "") {
          return sendError("change-name", "Name cannot be empty.");
        }
        const code = roomCode.toUpperCase();
        const room = getRoom(code);
        if (!room) return sendError("change-name", "Room not found.");
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          const oldName = player.name;
          player.name = newName.trim();
          if (player.isHost) {
            room.hostName = player.name;
          }
          
          broadcastToRoom(io, code, "player-name-changed", (pId) => ({
            room: serializeRoomForPlayer(room, pId),
            oldName,
            newName: player.name,
            playerId: socket.id
          }));
          broadcastToRoom(io, code, "room-updated", (pId) => serializeRoomForPlayer(room, pId));
        }
      } catch (err) {
        sendError("change-name", err.message);
      }
    });

    // 10. CHAT MESSAGE
    socket.on("send-chat", ({ roomCode, message }) => {
      const room = getRoom(roomCode);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          io.to(roomCode.toUpperCase()).emit("chat-message", {
            sender: player.name,
            senderId: socket.id,
            message,
            timestamp: new Date().toLocaleTimeString()
          });
        }
      }
    });

    // DISCONNECT
    socket.on("disconnect", () => {
      if (process.env.DEBUG === "true") {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      }
      const affectedRooms = handlePlayerDisconnect(socket.id);
      
      for (const room of affectedRooms) {
        const player = room.players.find(p => p.id === socket.id);
        const name = player ? player.name : "Unknown Player";
        
        broadcastToRoom(io, room.roomCode, "player-disconnected", (pId) => ({
          playerId: socket.id,
          playerName: name,
          room: serializeRoomForPlayer(room, pId)
        }));
        broadcastToRoom(io, room.roomCode, "room-updated", (pId) => serializeRoomForPlayer(room, pId));

        // Attempt auto-play if it's the disconnected player's turn
        checkAndProcessOfflineTurns(io, room);
      }
    });
  });
}
