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
import { resolveTrick, continueRound, placeBid, playCard } from "../gameEngine/gameManager.js";

function serializeRoom(room) {
  if (!room) return null;
  const gs = room.gameState || {};
  const dealerPlayer = gs.players && gs.dealerIndex !== undefined ? gs.players[gs.dealerIndex] : null;
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    hostName: room.hostName,
    status: room.status,
    isPublic: room.isPublic,
    settings: room.settings,
    players: room.players || [],
    gameState: room.gameState,
    
    // Flattened properties for easy verification
    hands: gs.hands || {},
    scores: gs.scores || {},
    bids: gs.bids || {},
    trump: gs.trump || null,
    round: gs.round || 1,
    dealer: dealerPlayer || null,
    phase: gs.phase || room.status || "waiting"
  };
}

export default function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

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
        socket.emit("room-created", serializeRoom(room));
        console.log(`[Socket] Room created: ${room.roomCode} by ${name}`);
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
          console.log(`[Socket] Sockets in room ${code} after rejoin:`, io.sockets.adapter.rooms.get(code));
          
          io.to(code).emit("player-reconnected", {
            room: serializeRoom(room),
            playerId: socket.id,
            playerName: name.trim()
          });
          io.to(code).emit("room-updated", serializeRoom(room));
          
          console.log(`[Socket] Player ${name} reconnected in Room ${code}`);
        } else {
          // Normal join flow
          const room = joinRoom(code, socket.id, name.trim());
          socket.join(code);
          console.log(`[Socket] Sockets in room ${code} after join:`, io.sockets.adapter.rooms.get(code));
          
          io.to(code).emit("player-joined", serializeRoom(room));
          io.to(code).emit("room-updated", serializeRoom(room));
          console.log(`[Socket] Player ${name} joined Room ${code}`);
        }
      } catch (err) {
        sendError("join-room", err.message);
      }
    });

    // 3. CHANGE SETTINGS
    socket.on("change-settings", ({ roomCode, settings }) => {
      try {
        const room = changeRoomSettings(roomCode, socket.id, settings);
        io.to(roomCode.toUpperCase()).emit("settings-updated", serializeRoom(room));
        io.to(roomCode.toUpperCase()).emit("room-updated", serializeRoom(room));
      } catch (err) {
        sendError("change-settings", err.message);
      }
    });

    // 4. START GAME
    socket.on("start-game", ({ roomCode }) => {
      try {
        const room = startGame(roomCode, socket.id);
        const codeUpper = room.roomCode.toUpperCase();
        
        // Print io.sockets.adapter.rooms.get(roomCode) as requested by step 6
        const roomSockets = io.sockets.adapter.rooms.get(codeUpper);
        console.log("io.sockets.adapter.rooms.get(roomCode)");
        console.log(roomSockets);

        // Expose debugging logs as requested by STEP 1 and STEP 3
        console.log("START GAME");
        console.log("ROOM STATE:", serializeRoom(room));
        console.log("PLAYERS LIST:", room.players);
        console.log("GAME STATE:", room.gameState);

        // Verify every socket is inside the room
        const playerSocketIds = room.players.map(p => p.id);
        const allInRoom = playerSocketIds.every(sid => roomSockets && roomSockets.has(sid));
        console.log(`[Verification] Every player socket inside room ${codeUpper}:`, allInRoom);
        if (!allInRoom) {
          console.warn("[Verification Warning] Some player socket is NOT in the room adapter!");
          playerSocketIds.forEach(sid => {
            console.log(`Socket ${sid} in room:`, roomSockets ? roomSockets.has(sid) : false);
          });
        }

        console.log("[Verification] Emitting game-started to room:", codeUpper);

        // Notify players that the game has started by sending gameState
        io.to(room.roomCode).emit("game-started", room.gameState);
        
        // Also emit cards-dealt right after to indicate hand deals
        io.to(room.roomCode).emit("cards-dealt", room.gameState);
        io.to(room.roomCode).emit("room-updated", serializeRoom(room));
        
        console.log(`[Socket] Game started in Room ${room.roomCode}`);
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
          io.to(room.roomCode).emit("all-bids-received", room.gameState);
        } else {
          io.to(room.roomCode).emit("bid-placed", room.gameState);
        }
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
        
        // Emits card-played immediately
        io.to(room.roomCode).emit("card-played", room.gameState);

        // Check if trick needs resolution
        if (room.gameState.phase === "resolvingTrick") {
          // Pause 2 seconds so all players can see the completed trick
          setTimeout(() => {
            try {
              // Retrieve fresh room reference in case of disconnects during timeout
              const currentRoom = getRoom(roomCode);
              if (!currentRoom || !currentRoom.gameState) return;
              
              const { winnerId, roundEnded } = resolveTrick(currentRoom.gameState);
              
              if (roundEnded) {
                if (currentRoom.gameState.phase === "gameEnd") {
                  currentRoom.status = "finished";
                  io.to(currentRoom.roomCode).emit("game-finished", currentRoom.gameState);
                } else {
                  // Round is over. Send scoreboard state
                  io.to(currentRoom.roomCode).emit("round-finished", currentRoom.gameState);
                  io.to(currentRoom.roomCode).emit("scoreboard", currentRoom.gameState);
                }
              } else {
                // Trick resolved, move to next play
                io.to(currentRoom.roomCode).emit("trick-finished", {
                  gameState: currentRoom.gameState,
                  winnerId
                });
              }
            } catch (err) {
              console.error(`[Socket Error] Error resolving trick: ${err.message}`);
            }
          }, 2000);
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
        
        // Calculate new gameState
        room.gameState = continueRound(room.gameState, socket.id);

        if (room.gameState.phase === "gameEnd") {
          room.status = "finished";
          io.to(room.roomCode).emit("game-finished", room.gameState);
        } else {
          io.to(room.roomCode).emit("next-round-started", room.gameState);
          io.to(room.roomCode).emit("cards-dealt", room.gameState);
        }
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

        // If targetPlayerId is specified, check if sender is host
        if (targetPlayerId && targetPlayerId !== socket.id) {
          if (room.hostId !== socket.id) {
            return sendError("leave-room", "Only the host can kick players.");
          }
          playerToRemoveId = targetPlayerId;
        }

        const updatedRoom = removePlayerFromRoom(code, playerToRemoveId);
        
        // Find the socket of the player being removed and disconnect them from the channel
        const targetSocket = io.sockets.sockets.get(playerToRemoveId);
        if (targetSocket) {
          targetSocket.leave(code);
          if (playerToRemoveId !== socket.id) {
            targetSocket.emit("room-closed", { message: "You have been kicked from the room." });
          }
        }
        
        if (updatedRoom) {
          io.to(code).emit("player-left", {
            room: serializeRoom(updatedRoom),
            playerId: playerToRemoveId
          });
          io.to(code).emit("room-updated", serializeRoom(updatedRoom));
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
        console.log(`[Socket] get-room-state for Room ${cleanCode}:`, room);
        console.log(`[Socket] Sockets in room ${cleanCode}:`, io.sockets.adapter.rooms.get(cleanCode));
        socket.emit("room-state", serializeRoom(room));
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
          io.to(code).emit("player-name-changed", {
            room: serializeRoom(room),
            oldName,
            newName: player.name,
            playerId: socket.id
          });
          io.to(code).emit("room-updated", serializeRoom(room));
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
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      const affectedRooms = handlePlayerDisconnect(socket.id);
      
      for (const room of affectedRooms) {
        const player = room.players.find(p => p.id === socket.id);
        const name = player ? player.name : "Unknown Player";
        
        io.to(room.roomCode).emit("player-disconnected", {
          playerId: socket.id,
          playerName: name,
          room: serializeRoom(room)
        });
        io.to(room.roomCode).emit("room-updated", serializeRoom(room));
      }
    });
  });
}
