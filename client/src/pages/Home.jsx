import React, { useState, useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { Eye, EyeOff, Play, Users, Bot, HelpCircle } from "lucide-react";

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
    clearError
  } = useGameStore();

  const [nameInput, setNameInput] = useState(playerName);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [offlineBotCount, setOfflineBotCount] = useState(3);
  const [showOfflineOptions, setShowOfflineOptions] = useState(false);

  useEffect(() => {
    setNameInput(playerName);
  }, [playerName]);

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

      {/* Top Bar for Accessibility toggle */}
      <div className="w-full max-w-md flex justify-end">
        <button
          onClick={toggleAccessibilityMode}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider transition-all duration-300 ${
            accessibilityMode
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
              : "bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-700"
          }`}
          aria-label="Toggle Accessibility Mode"
        >
          {accessibilityMode ? (
            <>
              <Eye className="w-3.5 h-3.5" /> ACCESSIBILITY ON
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5" /> ACCESSIBILITY OFF
            </>
          )}
        </button>
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
              ENTER YOUR NAME
            </label>
            <input
              id="playerName"
              type="text"
              placeholder="e.g. Vasudev"
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
              <Play className="w-4 h-4" /> ENTER ROOM CODE
            </button>
          ) : (
            <form onSubmit={handleJoinRoom} className="mb-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <label className="block text-slate-400 text-xs font-bold tracking-wider mb-2">
                ENTER ROOM CODE
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. AEY"
                  maxLength={6}
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 font-bold tracking-widest text-center uppercase outline-none accessibility-focus"
                />
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold px-4 py-2 rounded-xl transition-all outline-none accessibility-focus text-xs tracking-wider"
                >
                  JOIN
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowCodeInput(false)}
                className="text-xs text-slate-400 hover:text-slate-200 mt-2 block mx-auto underline outline-none"
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
                min={2}
                max={7}
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
    </div>
  );
}
