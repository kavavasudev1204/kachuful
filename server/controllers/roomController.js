import { initGame } from "../gameEngine/gameManager.js";

// In-memory rooms database
const rooms = {};
// In-memory active expiry timers: roomCode -> Timeout
const roomExpiryTimers = new Map();

// Helper to generate a random room code (3 to 6 chars)
function generateRoomCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 3; i++) {
    code += letters.charAt(
      Math.floor(Math.random() * letters.length)
    );
  }
  return code;
}

export function createRoom(hostId, hostName) {
  let roomCode;
  do {
    roomCode = generateRoomCode();
  } while (rooms[roomCode]);
  
  const room = {
    roomCode,
    hostId,
    hostName,
    status: "waiting", // waiting, playing, finished
    isPublic: false,
    settings: {
      scoreMode: "ADD_10", // ADD_10 or MULTIPLY_10
      maxRounds: 6, // default, will be adjusted when players join
      enableLastBidRestriction: true
    },
    players: [
      {
        id: hostId,
        name: hostName,
        isHost: true,
        isBot: false,
        connected: true
      }
    ],
    gameState: null
  };
  
  rooms[roomCode] = room;
  
  // Ensure any existing timer is cleared (shouldn't exist for new room, but safe practice)
  clearRoomExpiryTimer(roomCode);
  
  return room;
}

export function getRoom(roomCode) {
  return rooms[roomCode.toUpperCase()];
}

export function joinRoom(roomCode, playerId, playerName) {
  const code = roomCode.toUpperCase();
  const room = rooms[code];
  if (!room) {
    throw new Error("Room not found.");
  }
  
  if (room.status !== "waiting") {
    // Check if player is trying to reconnect by name
    const existingPlayer = room.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
    if (existingPlayer) {
      // Reconnect flow handles this, throw error here so client knows to reconnect
      throw new Error("Game in progress. Use reconnect instead.");
    }
    throw new Error("Game has already started.");
  }
  
  // Check if player with same name already exists
  const nameExists = room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (nameExists) {
    throw new Error("A player with this name already exists in the room.");
  }
  
  // Add new player
  const player = {
    id: playerId,
    name: playerName,
    isHost: false,
    isBot: false,
    connected: true
  };
  
  room.players.push(player);
  
  // Adjust default max rounds based on player count (players * rounds <= 52)
  const maxAllowed = Math.floor(52 / room.players.length);
  if (room.settings.maxRounds > maxAllowed) {
    room.settings.maxRounds = maxAllowed;
  }
  
  // Clear room expiry if there are active players
  clearRoomExpiryTimer(code);
  
  return room;
}

export function removePlayerFromRoom(roomCode, playerId) {
  const room = rooms[roomCode.toUpperCase()];
  if (!room) return null;
  
  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return room;
  
  const wasHost = room.players[playerIndex].isHost;
  room.players.splice(playerIndex, 1);
  
  // If lobby was playing, check if game is dead
  if (room.players.length === 0) {
    startRoomExpiryTimer(roomCode);
    return null;
  }
  
  // Promote another player to host if host left
  if (wasHost && room.players.length > 0) {
    room.players[0].isHost = true;
    room.hostId = room.players[0].id;
    room.hostName = room.players[0].name;
  }
  
  // Adjust max rounds
  const maxAllowed = Math.floor(52 / room.players.length);
  if (room.settings.maxRounds > maxAllowed) {
    room.settings.maxRounds = maxAllowed;
  }
  
  return room;
}

export function changeRoomSettings(roomCode, playerId, settings) {
  const room = rooms[roomCode.toUpperCase()];
  if (!room) throw new Error("Room not found.");
  
  // Check permission
  if (room.hostId !== playerId) {
    throw new Error("Only the host can change settings.");
  }
  
  const maxAllowed = Math.floor(52 / room.players.length);
  const requestedRounds = settings.maxRounds ?? room.settings.maxRounds;
  
  if (requestedRounds > maxAllowed) {
    throw new Error(`Invalid number of rounds: Maximum rounds for ${room.players.length} players is ${maxAllowed}.`);
  }
  
  room.settings.scoreMode = settings.scoreMode ?? room.settings.scoreMode;
  room.settings.maxRounds = requestedRounds;
  room.settings.enableLastBidRestriction = settings.enableLastBidRestriction !== false;
  if (settings.isPublic !== undefined) {
    room.isPublic = settings.isPublic;
  }
  
  return room;
}

export function startGame(roomCode, playerId) {
  const room = rooms[roomCode.toUpperCase()];
  if (!room) throw new Error("Room not found.");
  
  if (room.hostId !== playerId) {
    throw new Error("Only the host can start the game.");
  }
  
  if (room.players.length < 2) {
    throw new Error("Need at least 2 players to start.");
  }
  
  room.status = "playing";
  room.gameState = initGame(room.players, room.settings);
  room.gameState.roomCode = room.roomCode;
  
  return room;
}

export function handlePlayerDisconnect(socketId) {
  const affectedRooms = [];
  
  for (const [code, room] of Object.entries(rooms)) {
    const player = room.players.find(p => p.id === socketId);
    if (player) {
      player.connected = false;
      affectedRooms.push(room);
      
      // Check if all players in this room are now disconnected
      const activeCount = room.players.filter(p => p.connected).length;
      if (activeCount === 0) {
        startRoomExpiryTimer(code);
      }
    }
  }
  
  return affectedRooms;
}

export function handlePlayerReconnect(roomCode, playerName, newSocketId) {
  const code = roomCode.toUpperCase();
  const room = rooms[code];
  if (!room) {
    throw new Error("Room not found.");
  }
  
  const player = room.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (!player) {
    throw new Error(`Player ${playerName} not found in this room.`);
  }
  
  // Update socket ID and connection status
  const oldSocketId = player.id;
  player.id = newSocketId;
  player.connected = true;
  
  // If player was host, update room hostId
  if (player.isHost) {
    room.hostId = newSocketId;
  }
  
  // If the game has started, we need to map their score and hand entries to the new socket ID
  if (room.gameState) {
    // Map scores
    if (room.gameState.scores[oldSocketId]) {
      room.gameState.scores[newSocketId] = room.gameState.scores[oldSocketId];
      delete room.gameState.scores[oldSocketId];
    } else if (!room.gameState.scores[newSocketId]) {
      room.gameState.scores[newSocketId] = [];
    }
    
    // Map hands
    if (room.gameState.hands[oldSocketId]) {
      room.gameState.hands[newSocketId] = room.gameState.hands[oldSocketId];
      delete room.gameState.hands[oldSocketId];
    }
    
    // Map bids
    if (room.gameState.bids[oldSocketId] !== undefined) {
      room.gameState.bids[newSocketId] = room.gameState.bids[oldSocketId];
      delete room.gameState.bids[oldSocketId];
    }
    
    // Map tricks won
    if (room.gameState.tricksWon[oldSocketId] !== undefined) {
      room.gameState.tricksWon[newSocketId] = room.gameState.tricksWon[oldSocketId];
      delete room.gameState.tricksWon[oldSocketId];
    }
    
    // Map playedCards
    room.gameState.playedCards.forEach(play => {
      if (play.playerId === oldSocketId) {
        play.playerId = newSocketId;
      }
    });
    
    // Map continueBy if needed
    if (room.gameState.continueBy === oldSocketId) {
      room.gameState.continueBy = newSocketId;
    }
    
    // Map players list in game state
    const gsPlayer = room.gameState.players.find(p => p.id === oldSocketId);
    if (gsPlayer) {
      gsPlayer.id = newSocketId;
    }
  }
  
  // Clear expiry timer since someone rejoined
  clearRoomExpiryTimer(code);
  
  return room;
}

// Start room deletion timer (5 minutes)
function startRoomExpiryTimer(roomCode) {
  if (roomExpiryTimers.has(roomCode)) return;
  
  const timeoutId = setTimeout(() => {
    delete rooms[roomCode];
    roomExpiryTimers.delete(roomCode);
    console.log(`[Room Controller] Room ${roomCode} deleted due to inactivity.`);
  }, 5 * 60 * 1000); // 5 minutes
  
  roomExpiryTimers.set(roomCode, timeoutId);
}

// Clear room deletion timer
function clearRoomExpiryTimer(roomCode) {
  const timeoutId = roomExpiryTimers.get(roomCode);
  if (timeoutId) {
    clearTimeout(timeoutId);
    roomExpiryTimers.delete(roomCode);
  }
}
