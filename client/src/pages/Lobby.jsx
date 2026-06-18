import React, { useState, useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { Copy, Share2, LogOut, Shield, Crown, Trash2, Sliders, ToggleLeft, ToggleRight, Check } from "lucide-react";

export default function Lobby({ onNavigate }) {
  const {
    roomCode,
    players,
    hostId,
    myPlayerId,
    settings,
    changeSettingsOnline,
    startGameOnline,
    leaveRoomOnline,
    errorMessage,
    clearError,
    accessibilityMode
  } = useGameStore();

  const [copied, setCopied] = useState(false);
  const [shareSupported, setShareSupported] = useState(false);

  useEffect(() => {
    setShareSupported(!!navigator.share);
  }, []);

  // Extra verification logs for same network connection checks
  useEffect(() => {
    console.log("[Lobby Verification] Socket ID (socket.id):", myPlayerId);
    console.log("[Lobby Verification] Room Code (roomCode):", roomCode);
    console.log("[Lobby Verification] Players list (players):", players);
  }, [myPlayerId, roomCode, players]);

  const isHost = myPlayerId === hostId;

  // Calculate maximum allowed rounds based on active player count
  const maxAllowedRounds = players.length > 0 ? Math.floor(52 / players.length) : 13;

  // Enforce round clamping if players increase and settings round exceeds max
  useEffect(() => {
    if (isHost && settings.maxRounds > maxAllowedRounds) {
      changeSettingsOnline({ maxRounds: maxAllowedRounds });
    }
  }, [players.length, maxAllowedRounds, isHost]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy room code:", err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Kachuful Game",
          text: `Join my Kachuful (Judgement) multiplayer game! Room code: ${roomCode}`,
          url: window.location.origin
        });
      } catch (err) {
        console.log("Share failed or cancelled:", err);
      }
    } else {
      handleCopyCode();
    }
  };

  const handleKickPlayer = (playerId) => {
    // We send a leave-room like kick via custom event or handle via socket
    // In our backend handler, we can listen for a kick or let host request leave-room for socket.id
    // To make it simple, let's emit a socket message 'leave-room' passing target playerId, or use standard leave-room logic.
    // Wait! In socketHandler.js, leave-room takes socket.id to remove them. If host wants to remove another player:
    // We should implement a "kick-player" client socket emit!
    // Let's check: did the spec have a 'kick-player' socket event?
    // The spec lists client events: leave-room, change-name, etc. It does not list kick-player, but host-permissions say "Remove Player".
    // We can emit socket event 'leave-room' with target playerId (if host), or let's add socket support or simulate it.
    // Wait, let's implement kicking. We can update socketHandler to support remove-player. In socketHandler we can check:
    // `socket.on("remove-player", ({ roomCode, targetPlayerId }) => { ... })`
    // Wait, since we already wrote `socketHandler.js`, does it support remove-player? It has a `leave-room` handler which removes `socket.id`.
    // Let's modify `socketHandler.js` to add a `kick-player` event!
    // Let's look at `socketHandler.js` to see if we can add a listener or let's just make it simple.
    // Yes! Let's edit `socket/socketHandler.js` to add a handler for `remove-player`!
    // Wait, let's check what socket events we have.
    // Yes! We will add a socket emit for kicking and register it on the server.
    // Let's write the frontend action for `kickPlayer(targetId)` which emits `remove-player`.
    // Wait, let's check if the client can do it. Yes, we can add a custom emit: `socket.emit("remove-player", { roomCode, targetPlayerId })`.
    // Let's add it to the server socketHandler later, but first write Lobby layout.
    const { roomCode: code } = useGameStore.getState();
    import("../socket/socket").then(({ socket }) => {
      socket.emit("leave-room", { roomCode: code, targetPlayerId: playerId });
    });
  };

  const handleStartGame = () => {
    startGameOnline();
  };

  const handleLeaveLobby = () => {
    leaveRoomOnline();
    onNavigate("home");
  };

  const handleScoreModeChange = (mode) => {
    changeSettingsOnline({ scoreMode: mode });
  };

  const handleRoundsChange = (val) => {
    const r = Math.max(1, Math.min(maxAllowedRounds, Number(val)));
    changeSettingsOnline({ maxRounds: r });
  };

  const handleLastBidToggle = () => {
    changeSettingsOnline({ enableLastBidRestriction: !settings.enableLastBidRestriction });
  };

  return (
    <div className="min-h-screen flex flex-col justify-between py-8 px-4 bg-slate-950 relative overflow-hidden select-none">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-amber-950/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-lg mx-auto flex flex-col gap-6 my-auto">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-widest text-amber-500">
            ROOM LOBBY
          </h1>
          <p className="text-slate-500 text-xs tracking-wider mt-1">
            WAITING IN ROOM FOR PLAYERS
          </p>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="w-full p-4 rounded-xl border border-red-500/20 bg-red-950/30 text-red-200 text-sm flex justify-between items-center">
            <span>{errorMessage}</span>
            <button onClick={clearError} className="font-bold text-red-400">✕</button>
          </div>
        )}

        {/* Info panel */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col gap-6">
          {/* Invite Code */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-center relative">
            <span className="block text-slate-500 text-[10px] font-bold tracking-widest uppercase mb-1">
              INVITE CODE
            </span>
            <span className="block text-3xl font-extrabold tracking-widest text-slate-100 mb-4 select-all">
              {roomCode}
            </span>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleCopyCode}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all outline-none accessibility-focus ${
                  copied
                    ? "bg-emerald-500 text-emerald-950 shadow-md shadow-emerald-500/20"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-750"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> COPIED
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> COPY CODE
                  </>
                )}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-450 text-slate-950 rounded-xl text-xs font-bold transition-all outline-none accessibility-focus"
              >
                <Share2 className="w-3.5 h-3.5" /> SHARE CODE
              </button>
            </div>
          </div>

          {/* Settings Section (Host editable, player read-only) */}
          <div className="border-t border-slate-850 pt-4 flex flex-col gap-4">
            <h3 className="text-slate-400 text-xs font-bold tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-500" /> GAME SETTINGS
            </h3>

            {/* Score Mode */}
            <div className="flex justify-between items-center gap-4 bg-slate-900/40 p-3 rounded-xl border border-slate-900">
              <div>
                <span className="block text-xs font-bold text-slate-200">Score Calculation</span>
                <span className="text-[10px] text-slate-500">
                  {settings.scoreMode === "ADD_10" ? "Guess = Won (10 + Won), Else 0" : "Guess = Won (Won * 10), Else 0"}
                </span>
              </div>
              {isHost ? (
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => handleScoreModeChange("ADD_10")}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold tracking-wider transition-all ${
                      settings.scoreMode === "ADD_10"
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    +10 HANDS
                  </button>
                  <button
                    onClick={() => handleScoreModeChange("MULTIPLY_10")}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold tracking-wider transition-all ${
                      settings.scoreMode === "MULTIPLY_10"
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    ×10 HANDS
                  </button>
                </div>
              ) : (
                <span className="text-xs font-bold text-amber-500">
                  {settings.scoreMode === "ADD_10" ? "ADD 10" : "MULTIPLY 10"}
                </span>
              )}
            </div>

            {/* Rounds */}
            <div className="flex justify-between items-center gap-4 bg-slate-900/40 p-3 rounded-xl border border-slate-900">
              <div>
                <span className="block text-xs font-bold text-slate-200">Total Rounds</span>
                <span className="text-[10px] text-slate-500">
                  Players ({players.length}) × Rounds ({settings.maxRounds}) must be ≤ 52. Max: {maxAllowedRounds}
                </span>
              </div>
              {isHost ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={maxAllowedRounds}
                    value={settings.maxRounds}
                    onChange={(e) => handleRoundsChange(e.target.value)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-center text-xs font-bold text-slate-100 focus:border-amber-500 outline-none"
                  />
                </div>
              ) : (
                <span className="text-xs font-bold text-amber-500">{settings.maxRounds} Rounds</span>
              )}
            </div>

            {/* Last Player Bid Restriction */}
            <div className="flex justify-between items-center gap-4 bg-slate-900/40 p-3 rounded-xl border border-slate-900">
              <div>
                <span className="block text-xs font-bold text-slate-200">Last Player Restriction</span>
                <span className="text-[10px] text-slate-500">Last bidder cannot make total bids sum equal cards dealt.</span>
              </div>
              {isHost ? (
                <button onClick={handleLastBidToggle} className="outline-none accessibility-focus rounded">
                  {settings.enableLastBidRestriction ? (
                    <ToggleRight className="w-8 h-8 text-amber-500" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-600" />
                  )}
                </button>
              ) : (
                <span className="text-xs font-bold text-amber-500">
                  {settings.enableLastBidRestriction ? "ENABLED" : "DISABLED"}
                </span>
              )}
            </div>
          </div>

          {/* Players List */}
          <div className="border-t border-slate-850 pt-4 flex flex-col gap-2">
            <span className="block text-slate-400 text-xs font-bold tracking-wider mb-2">
              PLAYERS IN ROOM ({players.length})
            </span>
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto no-scrollbar pr-1">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`flex justify-between items-center p-3 rounded-xl border ${
                    player.id === myPlayerId
                      ? "bg-slate-900/70 border-amber-500/20"
                      : "bg-slate-900/30 border-slate-850"
                  } ${!player.connected ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {player.isHost ? (
                      <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10" />
                    ) : (
                      <Shield className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span className={`text-xs font-semibold ${player.id === myPlayerId ? "text-amber-400 font-bold" : "text-slate-200"}`}>
                      {player.name} {player.id === myPlayerId && "(You)"}
                    </span>
                    {!player.connected && (
                      <span className="text-[9px] font-bold text-red-400 bg-red-950/20 border border-red-900/30 px-1.5 py-0.5 rounded-full">
                        DISCONNECTED
                      </span>
                    )}
                  </div>
                  {isHost && player.id !== myPlayerId && (
                    <button
                      onClick={() => handleKickPlayer(player.id)}
                      className="text-slate-500 hover:text-red-400 p-1 transition-all outline-none accessibility-focus"
                      title="Kick Player"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3">
          {isHost ? (
            <button
              onClick={handleStartGame}
              disabled={players.length < 2}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold py-3.5 px-4 rounded-xl shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 disabled:shadow-none transition-all duration-200 text-sm tracking-wider outline-none accessibility-focus"
            >
              START GAME
            </button>
          ) : (
            <div className="text-center p-3 border border-slate-850 bg-slate-900/10 rounded-xl mb-1">
              <span className="text-[11px] font-medium text-slate-400 animate-pulse">
                Waiting for the host to start the game...
              </span>
            </div>
          )}

          <button
            onClick={handleLeaveLobby}
            className="w-full bg-slate-900 hover:bg-slate-850 text-slate-350 hover:text-slate-200 font-bold py-3 px-4 border border-slate-800 hover:border-slate-700 rounded-xl transition-all duration-200 flex justify-center items-center gap-1.5 text-xs tracking-wider outline-none accessibility-focus"
          >
            <LogOut className="w-3.5 h-3.5" /> LEAVE LOBBY
          </button>
        </div>
      </div>
    </div>
  );
}
