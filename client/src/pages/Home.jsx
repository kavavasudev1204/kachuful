import React, { useState, useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { Eye, EyeOff, Play, Users, Bot, HelpCircle, Trophy, Award, Gift, Coins } from "lucide-react";
import { sounds } from "../utils/soundEffects";

export default function Home({ onNavigate }) {
  const {
    playerName,
    setPlayerName,
    createRoomOnline,
    joinRoomOnline,
    startOfflineGame,
    accessibilityMode,
    toggleAccessibilityMode,
    errorMessage,
    clearError,
    coins,
    playerStats,
    dailyRewardLastClaimed,
    globalLeaderboard,
    getPlayerStats,
    getLeaderboard,
    claimDailyReward,
    joinAsSpectator
  } = useGameStore();

  const [nameInput, setNameInput] = useState(playerName);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [offlineBotCount, setOfflineBotCount] = useState(3);
  const [showOfflineOptions, setShowOfflineOptions] = useState(false);

  // Modal display states
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showDailyReward, setShowDailyReward] = useState(false);

  // Daily Claim timer states
  const [canClaim, setCanClaim] = useState(false);
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState("");

  useEffect(() => {
    setNameInput(playerName);
    if (playerName && playerName.trim() !== "") {
      getPlayerStats(playerName);
    }
  }, [playerName]);

  // Fetch leaderboard on mount
  useEffect(() => {
    getLeaderboard();
  }, []);

  const checkClaimStatus = () => {
    const lastClaimed = dailyRewardLastClaimed ? new Date(dailyRewardLastClaimed) : null;
    if (!lastClaimed) {
      setCanClaim(true);
      setTimeUntilNextClaim("");
      return;
    }
    const diff = Date.now() - lastClaimed.getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (diff >= twentyFourHours) {
      setCanClaim(true);
      setTimeUntilNextClaim("");
    } else {
      setCanClaim(false);
      const remaining = twentyFourHours - diff;
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      setTimeUntilNextClaim(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    }
  };

  useEffect(() => {
    checkClaimStatus();
    const interval = setInterval(checkClaimStatus, 1000);
    return () => clearInterval(interval);
  }, [dailyRewardLastClaimed]);

  const handleSaveName = (val) => {
    const trimmed = val.trim();
    setNameInput(trimmed);
    setPlayerName(trimmed);
  };

  const handleCreateRoom = () => {
    if (!nameInput.trim()) {
      useGameStore.getState().setError("Please enter a name first.");
      return;
    }
    handleSaveName(nameInput);
    createRoomOnline(nameInput);
    onNavigate("lobby");
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      useGameStore.getState().setError("Please enter a name first.");
      return;
    }
    if (!roomCodeInput.trim()) {
      useGameStore.getState().setError("Please enter a room code.");
      return;
    }
    handleSaveName(nameInput);
    joinRoomOnline(roomCodeInput.toUpperCase(), nameInput);
    onNavigate("lobby");
  };

  const handleWatchRoom = () => {
    if (!nameInput.trim()) {
      useGameStore.getState().setError("Please enter a name first.");
      return;
    }
    if (!roomCodeInput.trim()) {
      useGameStore.getState().setError("Please enter a room code.");
      return;
    }
    handleSaveName(nameInput);
    joinAsSpectator(roomCodeInput.toUpperCase(), nameInput);
    onNavigate("game");
  };

  const handlePlayOffline = () => {
    if (!nameInput.trim()) {
      useGameStore.getState().setError("Please enter a name first.");
      return;
    }
    handleSaveName(nameInput);
    startOfflineGame(nameInput, offlineBotCount, {
      scoreMode: "ADD_10",
      enableLastBidRestriction: true
    });
    onNavigate("game");
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center py-8 px-4 bg-slate-950 relative overflow-hidden select-none">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-950/15 rounded-full blur-[120px]" />

      {/* Top Dashboard Bar */}
      <div className="w-full max-w-md flex items-center justify-between gap-4 z-10">
        {/* Left Side: Coins */}
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-full px-3.5 py-1.5 shadow-lg shadow-slate-950/50 backdrop-blur-sm">
          <Coins className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="text-sm font-bold tracking-wide text-slate-200">{coins} <span className="text-[10px] text-amber-500/80 font-bold">COINS</span></span>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Daily Gift Button */}
          <button
            onClick={() => setShowDailyReward(true)}
            className={`p-2 rounded-full border transition-all duration-300 relative ${
              canClaim
                ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-400 hover:border-emerald-400 shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/25 animate-bounce"
                : "bg-slate-900/80 border-slate-800 text-slate-500 hover:text-slate-300"
            }`}
            aria-label="Daily Reward"
          >
            <Gift className="w-4 h-4" />
            {canClaim && (
              <span className="absolute top-0 right-0 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </button>

          {/* Stats Button */}
          <button
            onClick={() => {
              if (nameInput.trim()) {
                getPlayerStats(nameInput);
              }
              setShowStats(true);
            }}
            className="p-2 rounded-full bg-slate-900/80 border border-slate-800 text-indigo-400 hover:text-indigo-300 hover:border-slate-700 hover:bg-slate-850/80 transition-all duration-200"
            aria-label="View Stats & Achievements"
          >
            <Award className="w-4 h-4" />
          </button>

          {/* Leaderboard Button */}
          <button
            onClick={() => {
              getLeaderboard();
              setShowLeaderboard(true);
            }}
            className="p-2 rounded-full bg-slate-900/80 border border-slate-800 text-amber-500 hover:text-amber-400 hover:border-slate-700 hover:bg-slate-850/80 transition-all duration-200"
            aria-label="View Global Leaderboard"
          >
            <Trophy className="w-4 h-4" />
          </button>

          {/* Accessibility Toggle */}
          <button
            onClick={toggleAccessibilityMode}
            className={`p-2 rounded-full border transition-all duration-200 ${
              accessibilityMode
                ? "bg-amber-500/10 border-amber-500 text-amber-400"
                : "bg-slate-900/80 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700"
            }`}
            aria-label="Toggle Accessibility Mode"
          >
            {accessibilityMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="w-full max-w-md flex flex-col items-center my-auto">
        <div className="text-center mb-8 relative">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 drop-shadow-md">
            JUDGEMENT
          </h1>
          <p className="text-slate-400 text-sm tracking-widest mt-2 font-medium">
            KACHUFUL CARD GAME
          </p>
          <div className="h-1 w-24 bg-gradient-to-r from-amber-500 to-transparent mx-auto mt-3 rounded-full" />
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="w-full mb-6 p-4 rounded-xl border border-red-500/20 bg-red-950/30 text-red-200 text-sm flex justify-between items-center animate-pulse">
            <span>{errorMessage}</span>
            <button onClick={clearError} className="font-bold text-red-400 hover:text-red-300 ml-2">✕</button>
          </div>
        )}

        {/* Main Controls Card */}
        <div className="w-full glass-panel p-6 rounded-3xl border border-slate-800 shadow-2xl relative">
          {/* Inner Glow Border */}
          <div className="absolute inset-0 rounded-3xl border border-amber-500/10 pointer-events-none" />

          {/* Name input */}
          <div className="mb-6">
            <label className="block text-slate-400 text-xs font-bold tracking-wider mb-2" htmlFor="playerName">
              Enter Your Name
            </label>
            <input
              id="playerName"
              type="text"
              placeholder="Your Name"
              maxLength={15}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-650 font-medium tracking-wide outline-none transition-all duration-200 accessibility-focus"
            />
          </div>

          {/* CREATE ROOM BUTTON */}
          <button
            onClick={handleCreateRoom}
            className="w-full mb-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transform hover:-translate-y-0.5 transition-all duration-200 flex justify-center items-center gap-2 outline-none accessibility-focus text-sm tracking-wider"
          >
            <Users className="w-4 h-4" /> CREATE ROOM
          </button>

          {/* JOIN ROOM TOGGLE */}
          {!showCodeInput ? (
            <button
              onClick={() => {
                setShowCodeInput(true);
                setShowOfflineOptions(false);
              }}
              className="w-full mb-3 bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-700 hover:border-slate-600 font-bold py-3 px-4 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 outline-none accessibility-focus text-sm tracking-wider"
            >
              <Play className="w-4 h-4" /> JOIN ROOM
            </button>
          ) : (
            <form onSubmit={handleJoinRoom} className="mb-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <label className="block text-slate-400 text-xs font-bold tracking-wider mb-2">
                ENTER ROOM CODE
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="e.g. ABC"
                  maxLength={6}
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 font-bold tracking-widest text-center uppercase outline-none accessibility-focus"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold py-2 rounded-xl transition-all outline-none accessibility-focus text-xs tracking-wider"
                >
                  PLAY
                </button>
                <button
                  type="button"
                  onClick={handleWatchRoom}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl transition-all outline-none accessibility-focus text-xs tracking-wider"
                >
                  WATCH
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowCodeInput(false)}
                className="text-xs text-slate-400 hover:text-slate-205 mt-2.5 block mx-auto underline outline-none"
              >
                Cancel
              </button>
            </form>
          )}

          {/* PLAY OFFLINE TOGGLE */}
          {!showOfflineOptions ? (
            <button
              onClick={() => {
                setShowOfflineOptions(true);
                setShowCodeInput(false);
              }}
              className="w-full bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 font-bold py-3 px-4 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 outline-none accessibility-focus text-sm tracking-wider"
            >
              <Bot className="w-4 h-4" /> PLAY OFFLINE
            </button>
          ) : (
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <label className="block text-slate-400 text-xs font-bold tracking-wider mb-2">
                NUMBER OF BOTS: {offlineBotCount}
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={offlineBotCount}
                onChange={(e) => setOfflineBotCount(Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500 mb-4 outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handlePlayOffline}
                  className="flex-1 bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold py-2 rounded-xl transition-all outline-none accessibility-focus text-xs tracking-wider"
                >
                  START GAME
                </button>
                <button
                  type="button"
                  onClick={() => setShowOfflineOptions(false)}
                  className="flex-1 bg-slate-900 border border-slate-700 text-slate-350 hover:text-slate-200 font-bold py-2 rounded-xl transition-all outline-none accessibility-focus text-xs tracking-wider"
                >
                  BACK
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-slate-500 max-w-xs leading-relaxed">
        Judgement is a forecasting card game. Players predict tricks won in each round. Bid wisely, play strategically!
      </div>

      {/* Global Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-slate-900/95 border border-slate-800 p-6 rounded-3xl shadow-2xl relative max-h-[80vh] flex flex-col">
            <div className="absolute inset-0 rounded-3xl border border-amber-500/10 pointer-events-none" />
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-250 tracking-wider flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" /> LEADERBOARD
              </h2>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="text-slate-400 hover:text-slate-205 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
              {globalLeaderboard.length === 0 ? (
                <div className="text-center py-8 text-slate-550 text-xs">No records yet. Be the first!</div>
              ) : (
                globalLeaderboard.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex justify-between items-center px-4 py-3 rounded-xl border ${
                      idx === 0
                        ? "bg-amber-500/5 border-amber-500/20"
                        : "bg-slate-900/60 border-slate-850"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-black w-5 text-center ${idx === 0 ? "text-amber-405" : idx === 1 ? "text-slate-350" : idx === 2 ? "text-amber-600" : "text-slate-500"}`}>
                        {idx + 1}
                      </span>
                      <span className={`text-sm font-semibold tracking-wide text-slate-200`}>
                        {item.playerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="text-right">
                        <span className="font-extrabold text-slate-200">{item.coins}</span> <span className="text-[10px] text-amber-550 font-bold">COINS</span>
                      </div>
                      <div className="text-right border-l border-slate-800 pl-3">
                        <span className="font-extrabold text-slate-200">{item.gamesWon}</span>/<span className="text-slate-400">{item.gamesPlayed}</span> <span className="text-[10px] text-slate-500">WINS</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats & Achievements Modal */}
      {showStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-slate-900/95 border border-slate-800 p-6 rounded-3xl shadow-2xl relative max-h-[80vh] flex flex-col">
            <div className="absolute inset-0 rounded-3xl border border-indigo-500/10 pointer-events-none" />
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-300 tracking-wider flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-400" /> PROFILE STATS
              </h2>
              <button
                onClick={() => setShowStats(false)}
                className="text-slate-400 hover:text-slate-205 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
              {/* Profile Details */}
              <div className="p-4 bg-indigo-955/10 border border-indigo-900/30 rounded-2xl">
                <div className="text-[10px] text-indigo-405 font-bold tracking-widest mb-0.5">PLAYER PROFILE</div>
                <div className="text-base font-black text-slate-200 mb-3">{nameInput.trim() || "Guest Player"}</div>
                
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-slate-900/50 border border-slate-850 rounded-xl">
                    <div className="text-[9px] text-slate-500 font-bold">GAMES</div>
                    <div className="text-xs font-black text-slate-200">{playerStats.gamesPlayed || 0}</div>
                  </div>
                  <div className="p-2 bg-slate-900/50 border border-slate-850 rounded-xl">
                    <div className="text-[9px] text-slate-500 font-bold">WINS</div>
                    <div className="text-xs font-black text-emerald-450">{playerStats.gamesWon || 0}</div>
                  </div>
                  <div className="p-2 bg-slate-900/50 border border-slate-850 rounded-xl">
                    <div className="text-[9px] text-slate-500 font-bold">COINS</div>
                    <div className="text-xs font-black text-amber-450">{playerStats.coins || 0}</div>
                  </div>
                </div>
              </div>

              {/* Achievements */}
              <div>
                <div className="text-[10px] text-slate-500 font-extrabold tracking-widest mb-2 px-1">ACHIEVEMENTS</div>
                
                <div className="flex flex-col gap-2">
                  {[
                    { id: "Novice", name: "Novice", desc: "Played 1 online match", icon: "🌱" },
                    { id: "First Victory", name: "First Victory", desc: "Won 1 online match", icon: "👑" },
                    { id: "Veteran", name: "Veteran", desc: "Played 10 online matches", icon: "🛡️" },
                    { id: "Coin Hoarder", name: "Coin Hoarder", desc: "Earned 500 coins total", icon: "💰" },
                    { id: "Kachuful Master", name: "Kachuful Master", desc: "Earned 1000 coins total", icon: "⚔️" }
                  ].map((ach, idx) => {
                    const isUnlocked = (playerStats.unlockedAchievements || []).includes(ach.id);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${
                          isUnlocked
                            ? "bg-slate-900/60 border-slate-800 text-slate-200"
                            : "bg-slate-950/20 border-slate-900/80 text-slate-650 opacity-55"
                        }`}
                      >
                        <span className="text-xl">{ach.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-bold ${isUnlocked ? "text-slate-200" : "text-slate-500"}`}>
                            {ach.name}
                          </div>
                          <div className="text-[9px] text-slate-500 leading-tight truncate">
                            {ach.desc}
                          </div>
                        </div>
                        {isUnlocked && (
                          <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            UNLOCKED
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Reward Modal */}
      {showDailyReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-slate-900/95 border border-slate-800 p-6 rounded-3xl shadow-2xl relative text-center">
            <div className="absolute inset-0 rounded-3xl border border-emerald-500/10 pointer-events-none" />
            <div className="flex justify-end">
              <button
                onClick={() => setShowDailyReward(false)}
                className="text-slate-400 hover:text-slate-205 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="my-2">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Gift className="w-6 h-6 text-emerald-450" />
              </div>
              
              <h2 className="text-xl font-black text-slate-105 tracking-wide mb-1">
                DAILY CLAIM
              </h2>
              <p className="text-slate-405 text-xs max-w-xs mx-auto mb-5">
                Claim 100 free coins every 24 hours to climb the leaderboard!
              </p>
              
              {canClaim ? (
                <button
                  onClick={() => {
                    if (!nameInput.trim()) {
                      useGameStore.getState().setError("Please enter a name first.");
                      setShowDailyReward(false);
                      return;
                    }
                    handleSaveName(nameInput);
                    claimDailyReward(nameInput.trim());
                    sounds.playWinner();
                    setShowDailyReward(false);
                  }}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-450 hover:to-teal-550 text-slate-950 font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-200 text-xs tracking-wider"
                >
                  CLAIM 100 COINS
                </button>
              ) : (
                <div className="w-full bg-slate-900 border border-slate-850 p-4 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-extrabold tracking-widest mb-1">NEXT REWARD IN</div>
                  <div className="text-xl font-black text-slate-350 tracking-wider font-mono">
                    {timeUntilNextClaim}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
