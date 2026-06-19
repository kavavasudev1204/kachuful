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
        socket.emit("room-created", room);
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
          
          io.to(code).emit("player-reconnected", {
            room,
            playerId: socket.id,
            playerName: name.trim()
          });
          io.to(code).emit("room-updated", room);
          
          console.log(`[Socket] Player ${name} reconnected in Room ${code}`);
        } else {
          // Normal join flow
          const room = joinRoom(code, socket.id, name.trim());
          socket.join(code);
          
          io.to(code).emit("player-joined", room);
          io.to(code).emit("room-updated", room);
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
        io.to(roomCode.toUpperCase()).emit("settings-updated", room);
        io.to(roomCode.toUpperCase()).emit("room-updated", room);
      } catch (err) {
        sendError("change-settings", err.message);
      }
    });

    // 4. START GAME
    socket.on("start-game", ({ roomCode }) => {
      try {
        const room = startGame(roomCode, socket.id);
        
        // Expose debugging logs as requested
        const players = room.players;
        console.log(roomCode);
        console.log(io.sockets.adapter.rooms.get(roomCode));
        console.log(players);

        // Notify players that the game has started by sending gameState
        io.to(room.roomCode).emit("game-started", room.gameState);
        
        // Also emit cards-dealt right after to indicate hand deals
        io.to(room.roomCode).emit("cards-dealt", room.gameState);
        io.to(room.roomCode).emit("room-updated", room);
        
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
            room: updatedRoom,
            playerId: playerToRemoveId
          });
          io.to(code).emit("room-updated", updatedRoom);
        } else {
          io.to(code).emit("room-closed", { message: "Room closed. Host left or all players disconnected." });
        }
      } catch (err) {
        sendError("leave-room", err.message);
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
            room,
            oldName,
            newName: player.name,
            playerId: socket.id
          });
          io.to(code).emit("room-updated", room);
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
          room
        });
        io.to(room.roomCode).emit("room-updated", room);
      }
    });
  });
}
