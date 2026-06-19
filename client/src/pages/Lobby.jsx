import React, { useState, useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { Copy, Share2, LogOut, Shield, Crown, Trash2, Sliders, ToggleLeft, ToggleRight, Check } from "lucide-react";
import { socket } from "../socket/socket";

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
    status,
    gameState,
    isSpectator
  } = useGameStore();

  const [copied, setCopied] = useState(false);
  const [shareSupported, setShareSupported] = useState(false);

  useEffect(() => {
    setShareSupported(!!navigator.share);
  }, []);

  // Extra verification logs for same network connection checks
  useEffect(() => {
    console.log("[Lobby Verification] Socket ID (socket.id):", myPlayerId || socket.id);
    console.log("[Lobby Verification] Room Code (roomCode):", roomCode);
    console.log("[Lobby Verification] Players list (players):", players);
  }, [myPlayerId, roomCode, players]);

  // Use state's myPlayerId, falling back to active socket.id if needed
  const activeMyPlayerId = myPlayerId || socket.id;
  const isHost = activeMyPlayerId === hostId;

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
    // Emit leave-room passing targetPlayerId, which server now supports
    socket.emit("leave-room", { roomCode, targetPlayerId: playerId });
  };

  const handleStartGame = () => {
    // Construct room state
    const dealerPlayer = gameState?.players && gameState?.dealerIndex !== undefined ? gameState.players[gameState.dealerIndex] : null;
    const room = {
      roomCode,
      players,
      hands: gameState?.hands || {},
      scores: gameState?.scores || {},
      bids: gameState?.bids || {},
      trump: gameState?.trump || null,
      round: gameState?.round || 1,
      dealer: dealerPlayer,
      phase: gameState?.phase || status || "waiting"
    };

    console.log(room);
    console.log(players);
    console.log(socket.id);
    
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

  // Helper to generate a unique gradient based on player name
  const getAvatarGradient = (name) => {
    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradients = [
      "from-pink-500 to-rose-500",
      "from-purple-500 to-indigo-500",
      "from-blue-500 to-cyan-500",
      "from-emerald-500 to-teal-500",
      "from-amber-500 to-orange-500",
      "from-red-500 to-rose-600"
    ];
    return gradients[hash % gradients.length];
  };

  return (
    <div className="h-screen max-h-screen flex flex-col justify-between bg-slate-950 relative overflow-hidden select-none">
      {isSpectator && (
        <div className="w-full bg-indigo-950/80 border-b border-indigo-500/30 py-2 px-6 flex justify-between items-center text-xs tracking-wider z-50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="font-extrabold text-indigo-300">SPECTATING LOBBY</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Room Code:</span>
            <span className="font-bold text-slate-200 tracking-widest uppercase">{roomCode}</span>
          </div>
        </div>
      )}
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-amber-950/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col px-4 pt-4 md:px-8 md:pt-6 overflow-hidden max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-3">
          <h1 className="text-2xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-500">
            ROOM LOBBY
          </h1>
          <p className="text-slate-500 text-[10px] tracking-wider uppercase font-medium">
            Waiting in room for players
          </p>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="w-full mb-3 p-2.5 rounded-xl border border-red-500/20 bg-red-950/30 text-red-200 text-xs flex justify-between items-center z-10">
            <span>{errorMessage}</span>
            <button onClick={clearError} className="font-bold text-red-400 ml-2">✕</button>
          </div>
        )}

        {/* Two Column Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden mb-4">
          {/* Left Column: Room Info & Settings */}
          <div className="flex flex-col gap-3 overflow-y-auto no-scrollbar max-h-[48vh] md:max-h-none">
            {/* Invite Panel */}
            <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 shadow-lg flex flex-col gap-2">
              <span className="block text-slate-500 text-[9px] font-bold tracking-widest uppercase">
                INVITE CODE
              </span>
              <span className="block text-2xl font-black tracking-widest text-slate-100 uppercase select-all">
                {roomCode}
              </span>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleCopyCode}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all outline-none accessibility-focus ${
                    copied
                      ? "bg-emerald-500 text-emerald-950"
                      : "bg-slate-850 text-slate-200 hover:bg-slate-800"
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
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-amber-500 hover:bg-amber-450 text-slate-950 rounded-lg text-[11px] font-bold transition-all outline-none accessibility-focus"
                >
                  <Share2 className="w-3.5 h-3.5" /> SHARE CODE
                </button>
              </div>
            </div>

            {/* Game Settings */}
            <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 shadow-lg flex flex-col gap-2.5">
              <h3 className="text-slate-400 text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-500" /> GAME SETTINGS
              </h3>

              {/* Score Mode */}
              <div className="flex justify-between items-center gap-3 bg-slate-900/40 p-2.5 rounded-xl border border-slate-900">
                <div className="flex-1">
                  <span className="block text-xs font-bold text-slate-200">Score Calculation</span>
                  <span className="text-[9px] text-slate-500 leading-tight block">
                    {settings.scoreMode === "ADD_10" ? "Guess = Won (10 + Won), Else 0" : "Guess = Won (Won * 10), Else 0"}
                  </span>
                </div>
                {isHost ? (
                  <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 shrink-0">
                    <button
                      onClick={() => handleScoreModeChange("ADD_10")}
                      className={`px-2.5 py-1 rounded-md text-[9px] font-extrabold tracking-wider transition-all ${
                        settings.scoreMode === "ADD_10"
                          ? "bg-amber-500 text-slate-950"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      +10
                    </button>
                    <button
                      onClick={() => handleScoreModeChange("MULTIPLY_10")}
                      className={`px-2.5 py-1 rounded-md text-[9px] font-extrabold tracking-wider transition-all ${
                        settings.scoreMode === "MULTIPLY_10"
                          ? "bg-amber-500 text-slate-950"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      ×10
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-extrabold text-amber-500 shrink-0">
                    {settings.scoreMode === "ADD_10" ? "ADD 10" : "MULTIPLY 10"}
                  </span>
                )}
              </div>

              {/* Rounds */}
              <div className="flex justify-between items-center gap-3 bg-slate-900/40 p-2.5 rounded-xl border border-slate-900">
                <div className="flex-1">
                  <span className="block text-xs font-bold text-slate-200">Total Rounds</span>
                  <span className="text-[9px] text-slate-500 leading-tight block">
                    Max allowed: {maxAllowedRounds} (Players: {players.length})
                  </span>
                </div>
                {isHost ? (
                  <input
                    type="number"
                    min={1}
                    max={maxAllowedRounds}
                    value={settings.maxRounds}
                    onChange={(e) => handleRoundsChange(e.target.value)}
                    className="w-14 bg-slate-950 border border-slate-850 rounded-lg py-1 px-1.5 text-center text-xs font-bold text-slate-100 focus:border-amber-500 outline-none shrink-0"
                  />
                ) : (
                  <span className="text-[11px] font-extrabold text-amber-500 shrink-0">{settings.maxRounds} Rounds</span>
                )}
              </div>

              {/* Last Player Bid Restriction */}
              <div className="flex justify-between items-center gap-3 bg-slate-900/40 p-2.5 rounded-xl border border-slate-900">
                <div className="flex-1">
                  <span className="block text-xs font-bold text-slate-200">Last Player Restriction</span>
                  <span className="text-[9px] text-slate-500 leading-tight block">Last bidder's bid + other bids cannot equal rounds.</span>
                </div>
                {isHost ? (
                  <button onClick={handleLastBidToggle} className="outline-none accessibility-focus rounded shrink-0">
                    {settings.enableLastBidRestriction ? (
                      <ToggleRight className="w-8 h-8 text-amber-500" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-600" />
                    )}
                  </button>
                ) : (
                  <span className="text-[11px] font-extrabold text-amber-500 shrink-0">
                    {settings.enableLastBidRestriction ? "ENABLED" : "DISABLED"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Players List */}
          <div className="glass-panel p-3.5 rounded-3xl border border-slate-800 flex flex-col gap-2 max-h-[48vh] md:max-h-none overflow-hidden">
            <span className="block text-slate-400 text-[10px] font-bold tracking-wider uppercase border-b border-slate-850 pb-1.5">
              PLAYERS IN ROOM ({players.length}/6)
            </span>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto no-scrollbar pr-1">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex justify-between items-center p-2 rounded-2xl border transition-all ${
                    player.id === activeMyPlayerId
                      ? "bg-slate-900/80 border-amber-500/25 shadow-md shadow-amber-500/5"
                      : "bg-slate-900/20 border-slate-850"
                  } ${!player.connected ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar Circle */}
                    <div className="relative shrink-0 select-none">
                      <div className={`w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(player.name)} text-white font-extrabold text-xs shadow-md`}>
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      {player.isHost && (
                        <div className="absolute -top-1.5 -right-1.5 bg-slate-950 rounded-full p-0.5 border border-amber-500">
                          <Crown className="w-2.5 h-2.5 text-amber-400 fill-amber-500/20" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <span className={`text-xs font-bold flex items-center gap-1.5 ${player.id === activeMyPlayerId ? "text-amber-400 font-black" : "text-slate-200"}`}>
                        {player.name} {player.id === activeMyPlayerId && "(You)"}
                        {player.isHost && <span className="text-[8px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1 rounded font-normal uppercase tracking-wider">Host</span>}
                      </span>
                      <span className="text-[9px] text-slate-500 font-medium">
                        {player.isBot ? "Computer Bot" : player.connected ? "Online" : "Disconnected"}
                      </span>
                    </div>
                  </div>

                  {isHost && player.id !== activeMyPlayerId && (
                    <button
                      onClick={() => handleKickPlayer(player.id)}
                      className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-all outline-none accessibility-focus shrink-0"
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
      </div>

      {/* Sticky Footer */}
      <div className="w-full bg-slate-950/90 border-t border-slate-900/60 backdrop-blur-md px-6 py-3.5 flex justify-between items-center gap-4 mt-auto z-10 shrink-0">
        <div className="flex flex-col items-start gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-amber-500 tracking-wider">
              Players {players.length}/6
            </span>
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <span className="text-[10px] text-slate-400 animate-pulse font-medium">
            {players.length < 2
              ? "Waiting for Players..."
              : isHost
              ? "Ready to Start Game"
              : "Waiting for Host to start game..."}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLeaveLobby}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-350 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold transition-all outline-none accessibility-focus"
          >
            <LogOut className="w-3.5 h-3.5" /> LEAVE LOBBY
          </button>

          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={players.length < 2}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold px-5 py-2 rounded-xl shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 disabled:shadow-none transition-all duration-200 text-xs tracking-wider outline-none accessibility-focus"
            >
              START GAME
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
