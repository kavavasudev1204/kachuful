import mongoose from "mongoose";

// In-memory stats cache fallback if MongoDB is not connected
const statsCache = new Map();

// Mongoose schema declaration (only compiles if active connection exists)
let PlayerStatsModel = null;
try {
  const playerStatsSchema = new mongoose.Schema({
    playerName: { type: String, required: true, unique: true },
    coins: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    unlockedAchievements: { type: [String], default: [] }
  });
  PlayerStatsModel = mongoose.model("PlayerStats", playerStatsSchema);
} catch (err) {
  // Model creation might fail if mongoose is not loaded or connected
  console.log("[Stats Controller] Mongoose model could not be initialized. Using In-Memory fallback.");
}

// Helper to get stats for a player
export async function getPlayerStats(playerName) {
  const nameKey = playerName.trim().toLowerCase();
  if (mongoose.connection.readyState === 1 && PlayerStatsModel) {
    try {
      let stats = await PlayerStatsModel.findOne({ playerName: { $regex: new RegExp(`^${playerName.trim()}$`, "i") } });
      if (!stats) {
        stats = await PlayerStatsModel.create({ playerName: playerName.trim() });
      }
      return stats;
    } catch (err) {
      console.error("[Stats Controller] DB lookup error:", err);
    }
  }

  // Fallback to cache
  if (!statsCache.has(nameKey)) {
    statsCache.set(nameKey, {
      playerName: playerName.trim(),
      coins: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      totalPoints: 0,
      unlockedAchievements: []
    });
  }
  return statsCache.get(nameKey);
}

// Helper to update player stats
export async function updatePlayerStats(playerName, updates) {
  const nameKey = playerName.trim().toLowerCase();
  if (mongoose.connection.readyState === 1 && PlayerStatsModel) {
    try {
      const stats = await PlayerStatsModel.findOneAndUpdate(
        { playerName: { $regex: new RegExp(`^${playerName.trim()}$`, "i") } },
        { $inc: {
            coins: updates.coins || 0,
            gamesPlayed: updates.gamesPlayed || 0,
            gamesWon: updates.gamesWon || 0,
            totalPoints: updates.totalPoints || 0
          },
          $addToSet: { unlockedAchievements: { $each: updates.unlockedAchievements || [] } }
        },
        { new: true, upsert: true }
      );
      return stats;
    } catch (err) {
      console.error("[Stats Controller] DB update error:", err);
    }
  }

  // Fallback to cache update
  const current = await getPlayerStats(playerName);
  current.coins += (updates.coins || 0);
  current.gamesPlayed += (updates.gamesPlayed || 0);
  current.gamesWon += (updates.gamesWon || 0);
  current.totalPoints += (updates.totalPoints || 0);
  
  if (updates.unlockedAchievements) {
    updates.unlockedAchievements.forEach(ach => {
      if (!current.unlockedAchievements.includes(ach)) {
        current.unlockedAchievements.push(ach);
      }
    });
  }
  
  statsCache.set(nameKey, current);
  return current;
}

// Fetch global leaderboard (Top 10 by coins/wins)
export async function getGlobalLeaderboard() {
  if (mongoose.connection.readyState === 1 && PlayerStatsModel) {
    try {
      const list = await PlayerStatsModel.find()
        .sort({ coins: -1, gamesWon: -1 })
        .limit(10);
      return list.map(item => ({
        playerName: item.playerName,
        coins: item.coins,
        gamesWon: item.gamesWon,
        gamesPlayed: item.gamesPlayed
      }));
    } catch (err) {
      console.error("[Stats Controller] Leaderboard DB fetch error:", err);
    }
  }

  // Fallback: sort in-memory cache
  const items = Array.from(statsCache.values());
  items.sort((a, b) => b.coins - a.coins || b.gamesWon - a.gamesWon);
  return items.slice(0, 10).map(item => ({
    playerName: item.playerName,
    coins: item.coins,
    gamesWon: item.gamesWon,
    gamesPlayed: item.gamesPlayed
  }));
}
