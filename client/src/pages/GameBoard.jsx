import React, { useState, useRef, useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { getTrumpSymbol, determineTrickWinner } from "../utils/gameEngine";
import ScoreTable from "../components/ScoreTable";
import { Send, MessageSquare, Menu, Award, Sparkles, RefreshCw, X, ShieldAlert, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "../utils/soundEffects";

export default function GameBoard({ onNavigate }) {
  const {
    roomCode,
    players,
    hostId,
    myPlayerId,
    settings,
    gameState,
    chats,
    sendChatOnline,
    sendChatOffline,
    placeBidOnline,
    placeBidOffline,
    playCardOnline,
    playCardOffline,
    leaveRoomOnline,
    leaveRoomOffline,
    isOffline,
    accessibilityMode,
    errorMessage,
    clearError
  } = useGameStore();

  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [selectedBid, setSelectedBid] = useState(null);
  const [cardPlayError, setCardPlayError] = useState("");
  const [muted, setMuted] = useState(sounds.isMuted());
  
  const chatEndRef = useRef(null);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  const [showWinnerBanner, setShowWinnerBanner] = useState(false);

  useEffect(() => {
    if (gameState?.lastTrickWinner?.resolvedAt) {
      setShowWinnerBanner(true);
      const timer = setTimeout(() => {
        setShowWinnerBanner(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setShowWinnerBanner(false);
    }
  }, [gameState?.lastTrickWinner?.resolvedAt]);

  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 text-slate-200">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-4" />
        <span>Synchronizing Game State...</span>
      </div>
    );
  }

  const {
    round,
    maxRounds,
    cardsPerPlayer,
    currentTurn,
    trump,
    hands,
    bids,
    tricksWon,
    playedCards,
    phase
  } = gameState;

  const activePlayer = gameState.players[currentTurn];
  const isMyTurn = activePlayer?.id === myPlayerId;
  const myHand = hands[myPlayerId] || [];

  // Bidding restriction check
  const priorBidsSum = Object.values(bids).reduce((sum, v) => sum + v, 0);
  const bidsCount = Object.keys(bids).length;
  const isLastBidder = bidsCount === gameState.players.length - 1;
  const forbiddenBid = isLastBidder && settings.enableLastBidRestriction && round === 1
    ? cardsPerPlayer - priorBidsSum
    : null;

  // Determine legality helper
  const isCardPlayable = (card) => {
    if (!isMyTurn || phase !== "playing") return false;
    if (playedCards.length === 0) return true;
    const leadSuit = playedCards[0]?.card?.suit;
    if (!leadSuit) return true;
    if (card.suit === leadSuit) return true;
    const hasLeadSuit = myHand.some(c => c.suit === leadSuit);
    return !hasLeadSuit;
  };

  // 1. Arrange players in a circle, starting with local player at bottom center
  const N = gameState.players.length;
  const myIndex = gameState.players.findIndex(p => p.id === myPlayerId);
  const orderedPlayers = [];
  for (let i = 0; i < N; i++) {
    // Prevent negative index values in JS
    const offsetIndex = (myIndex + i) % N;
    orderedPlayers.push(gameState.players[offsetIndex >= 0 ? offsetIndex : 0]);
  }

  const getPolarCoords = (index, total) => {
    // 0 is bottom center, distribute clockwise
    const angle = 90 + (index * 360) / total;
    const rad = (angle * Math.PI) / 180;
    // Radial offset is elliptical (68% horizontal, 58% vertical) to sit perfectly outside the felt border
    return {
      left: `calc(50% + ${68 * Math.cos(rad)}%)`,
      top: `calc(50% + ${58 * Math.sin(rad)}%)`,
      angle
    };
  };

  // 2. Played cards center mapping offset
  const getPlayedCardOffset = (playerId) => {
    const idx = orderedPlayers.findIndex(p => p.id === playerId);
    if (idx === -1) return { x: 0, y: 0, rotate: 0 };
    const angle = 90 + (idx * 360) / N;
    const rad = (angle * Math.PI) / 180;
    // Elliptical layout for table cards matching player seat directions
    return {
      x: 85 * Math.cos(rad),
      y: 50 * Math.sin(rad),
      rotate: ((idx * 6) % 14) - 7
    };
  };

  // 3. Card Suit Styles & Colors
  const getSuitSymbol = (suit) => getTrumpSymbol(suit);
  const getSuitColor = (suit) => {
    if (suit === "HEART" || suit === "DIAMOND") return "text-red-600";
    return "text-slate-950";
  };
  
  const getCardColorClasses = (suit) => {
    if (suit === "HEART" || suit === "DIAMOND") {
      return "bg-white border-slate-200 text-red-600";
    }
    return "bg-white border-slate-200 text-slate-950";
  };

  const handleToggleMute = () => {
    const m = sounds.toggleMute();
    setMuted(m);
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (isOffline) {
      sendChatOffline(chatInput);
    } else {
      sendChatOnline(chatInput);
    }
    setChatInput("");
  };

  const handleBidSubmit = (bidValue) => {
    if (isOffline) {
      placeBidOffline(bidValue);
    } else {
      placeBidOnline(bidValue);
    }
    setSelectedBid(null);
  };

  const handlePlayCard = (card) => {
    if (!isMyTurn) return;
    setCardPlayError("");
    try {
      if (isOffline) {
        playCardOffline(card);
      } else {
        playCardOnline(card);
      }
    } catch (err) {
      setCardPlayError(err.message);
      setTimeout(() => setCardPlayError(""), 3000);
    }
  };

  const handleExitGame = () => {
    if (isOffline) {
      leaveRoomOffline();
    } else {
      leaveRoomOnline();
    }
    onNavigate("home");
  };

  // New premium card dimensions: Hand (120x170 px) & Table (110x160 px), Mobile (90x130 px & 80x115 px)
  const widthClass = accessibilityMode
    ? "w-[105px] sm:w-[140px]"
    : "w-[90px] sm:w-[120px]";
  const heightClass = accessibilityMode
    ? "h-[150px] sm:h-[200px]"
    : "h-[130px] sm:h-[170px]";
  
  const tableWidthClass = accessibilityMode
    ? "w-[95px] sm:w-[125px]"
    : "w-[80px] sm:w-[110px]";
  const tableHeightClass = accessibilityMode
    ? "h-[138px] sm:h-[180px]"
    : "h-[115px] sm:h-[160px]";

  // Fan rotation calculation
  const getFanStyle = (idx, total) => {
    if (total <= 1) return { x: 0, y: 0, rotate: 0 };
    
    // Dynamic spread and spacing based on total card count
    const maxSpread = Math.min(60, (total - 1) * (total > 8 ? 6 : 8)); 
    const startAngle = -maxSpread / 2;
    const angleStep = maxSpread / (total - 1);
    const rotate = startAngle + idx * angleStep;
    
    const centerIdx = (total - 1) / 2;
    const distanceFromCenter = idx - centerIdx;
    
    // Spacing dynamically squeezes to prevent screen horizontal overflows
    const horizontalSpacing = total > 10 ? 18 : total > 7 ? 24 : 32;
    const xOffset = distanceFromCenter * horizontalSpacing;
    
    // Arch height offset (y goes down on edges)
    const archHeightMultiplier = total > 10 ? 1.5 : 2.5;
    const yOffset = Math.pow(distanceFromCenter, 2) * archHeightMultiplier;
    
    return {
      x: xOffset,
      y: yOffset,
      rotate: rotate
    };
  };

  // Determine winning played card
  const winningPlay = determineTrickWinner({ playedCards, activeTrump: trump });
  const deckSize = gameState.deck?.length ?? (52 - (N * round));

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 relative overflow-hidden select-none">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-950/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Top HUD */}
      <div className="w-full px-4 py-3 bg-slate-900/60 border-b border-slate-900 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={handleExitGame}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-slate-200 rounded-xl text-xs font-bold transition-all outline-none accessibility-focus"
          >
            EXIT GAME
          </button>
          <div className="flex flex-col text-[10px] tracking-wide text-slate-500 font-bold uppercase">
            <span>Room Code</span>
            <span className="text-slate-300 text-xs font-extrabold select-all">{roomCode}</span>
          </div>
        </div>

        {/* Round and Trump info */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Round</span>
            <span className="text-amber-500 font-extrabold text-sm">
              {round} / {maxRounds}
            </span>
          </div>
          <div className="flex flex-col items-center bg-slate-950/60 px-3 py-1 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Trump</span>
            <span className={`text-base font-extrabold flex items-center gap-1 ${trump === "HEART" || trump === "DIAMOND" ? "text-red-500" : "text-slate-300"}`}>
              {getSuitSymbol(trump)}
              {accessibilityMode && <span className="text-xs uppercase text-slate-400 font-medium">({trump.substring(0, 5)})</span>}
            </span>
          </div>
        </div>

        {/* Controls block (Mute + Chat) */}
        <div className="flex items-center gap-2">
          {/* Mute Toggle */}
          <button
            onClick={handleToggleMute}
            className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-255 rounded-xl transition-all outline-none accessibility-focus"
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Chat toggle */}
          <button
            onClick={() => setShowChat(!showChat)}
            className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl relative transition-all outline-none accessibility-focus"
            aria-label="Toggle chat log"
          >
            <MessageSquare className="w-4 h-4" />
            {chats.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 text-[9px] font-extrabold rounded-full flex justify-center items-center">
                {chats.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Game Screen */}
      <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col items-center justify-center relative px-2">
        {/* Play error message overlay */}
        {cardPlayError && (
          <div className="absolute top-4 bg-red-950/90 border border-red-500/30 text-red-200 px-4 py-2 rounded-xl text-xs font-semibold z-30 shadow-lg flex items-center gap-1.5 animate-bounce">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            {cardPlayError}
          </div>
        )}

        {/* Premium Oval Card Table Felt Area */}
        <div className="w-[90vw] h-[56vw] max-w-[550px] max-h-[340px] rounded-[50%] bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 border-[6px] border-amber-800 shadow-[inset_0_0_45px_rgba(0,0,0,0.95),_0_15px_35px_rgba(0,0,0,0.6)] ring-4 ring-amber-500/35 relative flex justify-center items-center my-6 z-10">
          
           {/* TRICK WINNER BANNER OVERLAY - Screen wide */}
           <AnimatePresence>
             {showWinnerBanner && gameState.lastTrickWinner && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="fixed inset-0 bg-slate-950/80 backdrop-blur-[3px] z-50 flex flex-col justify-center items-center pointer-events-auto"
               >
                 <motion.div
                   initial={{ scale: 0.8, y: 30 }}
                   animate={{ scale: 1, y: 0 }}
                   exit={{ scale: 0.8, y: 30 }}
                   className="bg-slate-900/95 border-2 border-amber-500/40 px-8 py-8 rounded-3xl shadow-[0_0_40px_rgba(234,179,8,0.25)] flex flex-col items-center gap-3 text-center max-w-sm relative overflow-hidden"
                 >
                   {/* Gold Corner Accents */}
                   <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-amber-500/50" />
                   <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-500/50" />
                   <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-amber-500/50" />
                   <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-500/50" />
                   
                   {/* Starburst shine effect background */}
                   <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 rotate-45 pointer-events-none scale-150 animate-pulse-slow" />
                   
                   {/* Trophy */}
                   <span className="text-6xl animate-bounce mb-2">🏆</span>

                   {/* Winner Name */}
                   <span className="text-3xl font-black text-amber-400 uppercase tracking-widest drop-shadow-md">
                     {gameState.lastTrickWinner.playerName}
                   </span>
                   
                   {/* Text */}
                   <span className="text-xs text-slate-350 font-black tracking-widest uppercase mb-1">
                     WON THIS HAND
                   </span>

                   {/* Card Badge */}
                   <div className="mt-2 px-4 py-2.5 bg-white border-2 border-amber-400 rounded-xl text-slate-900 font-black flex items-center gap-2 shadow-xl text-sm relative">
                     <span className={gameState.lastTrickWinner.winningCard.suit === "HEART" || gameState.lastTrickWinner.winningCard.suit === "DIAMOND" ? "text-red-600" : "text-slate-900"}>
                       {getSuitSymbol(gameState.lastTrickWinner.winningCard.suit)}
                     </span>
                     <span>{gameState.lastTrickWinner.winningCard.rank}</span>
                   </div>
                 </motion.div>
               </motion.div>
             )}
           </AnimatePresence>

           {/* Deck stack area (on the left) */}
           <div className="absolute left-[8%] top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-1.5 z-20 pointer-events-none select-none">
             <div className="relative w-8 h-12 sm:w-10 sm:h-14">
               <div className="absolute top-0 left-0 w-full h-full bg-blue-900 border border-blue-500 rounded-md shadow transform -rotate-6"
                    style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)" }} />
               <div className="absolute top-0.5 left-0.5 w-full h-full bg-blue-900 border border-blue-500 rounded-md shadow transform rotate-3"
                    style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)" }} />
               <div className="absolute top-1 left-1 w-full h-full bg-blue-950 border-2 border-blue-400 rounded-md shadow-md flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)" }}>
                 <span className="text-[10px] sm:text-xs text-blue-400 font-bold font-serif">🂠</span>
               </div>
             </div>
             <span className="text-[8px] sm:text-[9px] font-black uppercase text-slate-400 tracking-wider bg-slate-950/80 px-2 py-0.5 rounded-full border border-slate-900">
               {deckSize} Cards
             </span>
           </div>

           {/* Trump Card Display (on the right) */}
           <div className="absolute right-[8%] top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-1.5 z-20 pointer-events-none select-none">
             <span className="text-[8px] sm:text-[9px] font-black uppercase text-amber-500 tracking-wider bg-slate-950/80 px-1.5 py-0.5 rounded-full border border-slate-900">
               Trump
             </span>
             <div className="w-8 h-12 sm:w-10 sm:h-14 bg-white border-2 border-amber-400 rounded-md shadow-md flex flex-col justify-between p-1 items-center">
               <span className={`text-lg sm:text-xl font-bold leading-none ${trump === "HEART" || trump === "DIAMOND" ? "text-red-650" : "text-slate-950"}`}
                     style={{ color: (trump === "HEART" || trump === "DIAMOND") ? "#dc2626" : "#020617" }}>
                 {getSuitSymbol(trump)}
               </span>
               <span className="text-[6px] sm:text-[7px] font-black uppercase text-slate-500 tracking-tight leading-none">
                 {trump.substring(0, 5)}
               </span>
             </div>
           </div>
          
          {/* Centered table contents (played cards pile) */}
          <div className="w-[180px] h-[180px] rounded-full bg-slate-950/5 relative flex justify-center items-center pointer-events-none">
            {playedCards.map((play) => {
              const offset = getPlayedCardOffset(play.playerId);
              const isWinningCard = winningPlay && winningPlay.playerId === play.playerId;
              const pName = players.find(p => p.id === play.playerId)?.name || "Bot";
              
              return (
                <motion.div
                  key={play.playerId}
                  initial={{ scale: 0, x: offset.x * 2.5, y: offset.y * 2.5, rotate: 18 }}
                  animate={{
                    scale: isWinningCard ? 1.2 : 1.0,
                    x: offset.x,
                    y: offset.y,
                    rotate: offset.rotate
                  }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                  className={`absolute ${tableWidthClass} ${tableHeightClass} rounded-xl bg-white border-2 flex flex-col justify-between relative transition-shadow ${
                    isWinningCard
                      ? "border-amber-400 ring-4 ring-amber-500/50 shadow-[0_0_25px_rgba(234,179,8,0.95)] z-10 animate-pulse-slow"
                      : "border-slate-200 shadow-md z-0"
                  }`}
                >
                  {/* Card Content */}
                  <div className="absolute top-1.5 left-1.5 flex flex-col items-center leading-none">
                    <span className="text-xs sm:text-sm font-black text-slate-950">{play.card.rank}</span>
                    <span className={`text-[10px] sm:text-xs ${getSuitColor(play.card.suit)}`}>
                      {getSuitSymbol(play.card.suit)}
                    </span>
                  </div>
                  
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className={`text-2xl sm:text-3xl opacity-80 select-none ${getSuitColor(play.card.suit)}`}>
                      {getSuitSymbol(play.card.suit)}
                    </span>
                  </div>
                  
                  <div className="absolute bottom-1.5 right-1.5 flex flex-col items-center leading-none transform rotate-180">
                    <span className="text-xs sm:text-sm font-black text-slate-950">{play.card.rank}</span>
                    <span className={`text-[10px] sm:text-xs ${getSuitColor(play.card.suit)}`}>
                      {getSuitSymbol(play.card.suit)}
                    </span>
                  </div>

                  {/* Player badge over/under card */}
                  {isWinningCard ? (
                    <div className="absolute bottom-[-18px] left-1/2 transform -translate-x-1/2 bg-amber-500 text-slate-950 text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg border border-amber-400 tracking-wider text-center select-none pointer-events-none z-20 whitespace-nowrap animate-bounce">
                      ✨ WINNER ✨
                    </div>
                  ) : (
                    <div className="absolute bottom-[-18px] left-1/2 transform -translate-x-1/2 bg-slate-950 text-slate-200 border border-slate-800 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md max-w-[65px] truncate text-center select-none pointer-events-none z-20">
                      {pName}
                    </div>
                  )}
                </motion.div>
              );
            })}

            {/* Turn status indicator text inside center of table */}
            {playedCards.length === 0 && (
              <div className="text-center p-3">
                <span className="block text-[10px] text-slate-400/80 font-extrabold tracking-widest uppercase mb-1">
                  {phase === "bidding" ? "BIDDING PHASE" : "PLAYING"}
                </span>
                <span className="block text-xs font-bold text-amber-500 animate-pulse truncate max-w-[120px]">
                  {activePlayer ? `${activePlayer.name}'s turn` : "Waiting"}
                </span>
              </div>
            )}
          </div>

          {/* Player avatars positioned dynamically around felt circumference */}
          {orderedPlayers.map((player, idx) => {
            const coords = getPolarCoords(idx, N);
            const isTurn = player.id === activePlayer?.id;
            const playerBid = bids[player.id];
            const hasBid = playerBid !== undefined;
            const playerTricks = tricksWon[player.id] || 0;
            const isMe = player.id === myPlayerId;
            
            // Count cards left in opponent's hand to show backside icons
            const opponentHandSize = hands[player.id]?.length || 0;

            return (
              <div
                key={player.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-15"
                style={{
                  left: coords.left,
                  top: coords.top
                }}
              >
                {/* Player Name ABOVE Avatar */}
                <div className="flex items-center gap-1 mb-1">
                  <span className={`text-[10px] font-bold tracking-wide truncate max-w-[70px] select-none ${isMe ? "text-amber-400 font-extrabold" : "text-slate-300"}`}>
                    {player.name}
                  </span>
                  {isMe && isTurn && (
                    <span className="text-emerald-400 font-extrabold text-[9px] animate-pulse ml-0.5">▶ YOUR TURN</span>
                  )}
                </div>

                {/* Avatar (⭕) */}
                <div
                  className={`w-14 h-14 rounded-full flex justify-center items-center relative transition-all duration-300 ${
                    isTurn
                      ? "ring-4 ring-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.8)] animate-pulse bg-emerald-950/20"
                      : "ring-2 ring-slate-800 bg-slate-900/90"
                  } ${!player.connected ? "opacity-40" : ""}`}
                >
                  <span className={`text-sm font-extrabold select-none ${isMe ? "text-amber-400 font-black" : "text-slate-200"}`}>
                    {player.name.substring(0, 2).toUpperCase()}
                  </span>

                  {/* Connected/Disconnected dots */}
                  {!player.connected && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 border-2 border-slate-950 rounded-full" />
                  )}
                  {player.connected && isTurn && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-950 rounded-full animate-ping" />
                  )}

                  {/* Floating active turn indicator */}
                  {isTurn && (
                    <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg shadow-emerald-500/30 uppercase tracking-widest animate-bounce z-25">
                      {isMe ? "YOUR TURN" : "TURN"}
                    </span>
                  )}
                </div>

                {/* Score Ratio BELOW Avatar */}
                <div className="bg-slate-950/80 border border-slate-850 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider text-slate-400 mt-1 shadow-sm uppercase">
                  {playerTricks} / {hasBid ? playerBid : "?"}
                </div>

                {/* Small indicator of opponent card counts (represented by overlapping card backs) */}
                {!isMe && opponentHandSize > 0 && (
                  <div className="absolute top-[-25px] flex -space-x-1 justify-center pointer-events-none opacity-80 scale-75">
                    {Array.from({ length: opponentHandSize }).map((_, cIdx) => (
                      <div
                        key={cIdx}
                        className="w-4 h-6 bg-blue-900 border border-blue-500 rounded-[2px] shadow-sm transform rotate-[-10deg]"
                        style={{
                          background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)"
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hand area at bottom */}
      <div className={`w-full bg-slate-900/30 border-t border-slate-900/60 pb-8 pt-4 px-4 relative ${phase === "bidding" ? "z-50" : "z-20"}`}>
        
        {/* Your hand header */}
        <div className="max-w-md mx-auto flex justify-between items-center mb-3 text-xs font-bold text-slate-400 select-none">
          <span>YOUR CARDS ({myHand.length})</span>
          {isMyTurn && (
            <span className="text-amber-500 animate-pulse tracking-widest font-black">
              ★ YOUR TURN TO PLAY
            </span>
          )}
        </div>

        {/* Hand Cards List - Radial Fanned Arc */}
        <div className="w-full max-w-[95vw] sm:max-w-xl h-[160px] sm:h-[200px] mx-auto relative flex justify-center items-end py-4 overflow-visible">
          {myHand.map((card, idx) => {
            const fan = getFanStyle(idx, myHand.length);
            const playable = isCardPlayable(card);
            const targetY = playable ? fan.y - 20 : fan.y;
            const targetScale = playable ? 1.15 : 1.0;
            const isLocked = phase === "playing" && !playable;
            const cardColorClass = getCardColorClasses(card.suit);

            return (
              <motion.button
                key={`${card.suit}-${card.rank}`}
                onClick={() => playable && handlePlayCard(card)}
                disabled={isLocked || phase !== "playing"}
                initial={{ scale: 0, x: -180, y: -120, rotate: 0, opacity: 0 }}
                animate={{
                  x: fan.x,
                  y: targetY,
                  rotate: fan.rotate,
                  scale: targetScale,
                  opacity: 1
                }}
                whileHover={playable ? {
                  y: targetY - 25,
                  scale: targetScale * 1.08,
                  zIndex: 100,
                  transition: { duration: 0.3, ease: "easeOut" }
                } : {}}
                transition={{ type: "spring", stiffness: 120, damping: 15, delay: idx * 0.08 }}
                className={`absolute bottom-6 left-1/2 -translate-x-1/2 ${widthClass} ${heightClass} rounded-[14px] shadow-xl border-2 flex flex-col justify-between origin-bottom cursor-pointer select-none transition-all duration-300 ${
                  playable
                    ? "border-emerald-400 ring-2 ring-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.45)] hover:shadow-[0_0_20px_rgba(16,185,129,0.7)] bg-white text-slate-900"
                    : isLocked
                    ? "opacity-35 blur-[0.4px] grayscale cursor-not-allowed border-slate-300 bg-white text-slate-900 pointer-events-none"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
                style={{
                  zIndex: idx
                }}
              >
                {/* Lock Overlay for locked cards */}
                {isLocked && (
                  <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[1px] rounded-[14px] flex flex-col items-center justify-center gap-1 text-slate-200 z-30 pointer-events-none">
                    <span className="text-xl">🔒</span>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-300">Locked</span>
                  </div>
                )}

                {/* Playable badge floater above the card */}
                {playable && (
                  <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-slate-950 text-[8px] font-extrabold px-1.5 py-0.5 rounded shadow-lg uppercase tracking-wider z-20 pointer-events-none animate-bounce">
                    Playable
                  </div>
                )}

                {/* Top-left Rank & Suit */}
                <div className="absolute top-2 left-2 flex flex-col items-center leading-none">
                  <span className={`${accessibilityMode ? "text-xl sm:text-2xl" : "text-sm sm:text-lg"} font-black`}>
                    {card.rank}
                  </span>
                  <span className={`${accessibilityMode ? "text-lg sm:text-xl" : "text-xs sm:text-base"} ${getSuitColor(card.suit)}`}>
                    {getSuitSymbol(card.suit)}
                  </span>
                </div>

                {/* Center Large Suit Icon */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className={`${accessibilityMode ? "text-5xl sm:text-6xl" : "text-3xl sm:text-4xl"} opacity-90 select-none ${getSuitColor(card.suit)}`}>
                    {getSuitSymbol(card.suit)}
                  </span>
                </div>

                {/* Bottom-right Rank & Suit (mirrored) */}
                <div className="absolute bottom-2 right-2 flex flex-col items-center leading-none transform rotate-180">
                  <span className={`${accessibilityMode ? "text-xl sm:text-2xl" : "text-sm sm:text-lg"} font-black`}>
                    {card.rank}
                  </span>
                  <span className={`${accessibilityMode ? "text-lg sm:text-xl" : "text-xs sm:text-base"} ${getSuitColor(card.suit)}`}>
                    {getSuitSymbol(card.suit)}
                  </span>
                </div>
              </motion.button>
            );
          })}

          {myHand.length === 0 && (
            <div className="text-slate-500 text-xs font-medium tracking-wide">
              No cards in hand. Waiting to start next trick...
            </div>
          )}
        </div>
      </div>

      {/* BIDPOPUP MODAL */}
      <AnimatePresence>
        {phase === "bidding" && isMyTurn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex justify-center items-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-slate-800 shadow-2xl relative"
            >
              <h2 className="text-lg font-extrabold text-amber-500 tracking-wider text-center mb-1">
                PLACE YOUR BID
              </h2>
              <p className="text-slate-400 text-xs text-center mb-6">
                Forecast the number of hands you expect to win
              </p>

              {/* Trump display */}
              <div className="mb-6 p-3 bg-slate-900/50 border border-slate-850 rounded-xl text-center flex items-center justify-center gap-2">
                <span className="text-xs font-bold text-slate-400">TRUMP SUIT:</span>
                <span className={`text-base font-extrabold flex items-center gap-1 ${getSuitColor(trump)}`}>
                  {getSuitSymbol(trump)} {trump}
                </span>
              </div>

              {/* Bidding Restriction Notification */}
              {forbiddenBid !== null && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-[10px] font-bold text-center uppercase tracking-wide leading-relaxed">
                  Last player restriction active! <br />
                  You CANNOT bid: <span className="text-sm font-extrabold text-amber-300">{forbiddenBid}</span>
                </div>
              )}

              {/* Bidding Option Grid */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {Array.from({ length: cardsPerPlayer + 1 }).map((_, val) => {
                  const isForbidden = val === forbiddenBid;
                  return (
                    <button
                      key={val}
                      onClick={() => handleBidSubmit(val)}
                      disabled={isForbidden}
                      className="aspect-square bg-slate-900 border border-slate-800 hover:border-amber-500/30 text-slate-100 disabled:opacity-20 disabled:cursor-not-allowed hover:bg-slate-850 font-extrabold rounded-xl transition-all flex justify-center items-center text-lg outline-none accessibility-focus"
                    >
                      {val}
                    </button>
                  );
                })}
              </div>

              <div className="text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  ROUND {round} ({cardsPerPlayer} {cardsPerPlayer === 1 ? "Card" : "Cards"} Dealt)
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ROUND END SCOREBOARD MODAL OVERLAY */}
      <AnimatePresence>
        {phase === "roundEnd" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-40 flex justify-center items-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-lg glass-panel p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="text-center">
                <h2 className="text-xl font-black text-amber-500 tracking-widest uppercase">
                  ROUND SCOREBOARD
                </h2>
                <p className="text-slate-500 text-[10px] tracking-wider uppercase font-semibold">
                  Trump Round Complete
                </p>
              </div>

              <ScoreTable isModal={true} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHAT LOG DRAWER PANEL */}
      <AnimatePresence>
        {showChat && (
          <>
            {/* Backdrop click closer */}
            <div
              onClick={() => setShowChat(false)}
              className="fixed inset-0 bg-black/40 z-30 pointer-events-auto"
            />
            
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed top-0 right-0 w-80 h-full bg-slate-900 border-l border-slate-800 z-40 flex flex-col justify-between"
            >
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <span className="text-xs font-extrabold tracking-widest text-slate-200 uppercase">
                  CHAT ROOM LOG
                </span>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-slate-400 hover:text-slate-200 outline-none accessibility-focus p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message log */}
              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-2.5">
                {chats.map((c, cIdx) => {
                  const isSys = c.sender === "System";
                  const isMe = c.senderId === myPlayerId;
                  
                  return (
                    <div
                      key={cIdx}
                      className={`flex flex-col max-w-[85%] ${
                        isSys
                          ? "mx-auto text-center w-full"
                          : isMe
                          ? "self-end items-end"
                          : "self-start items-start"
                      }`}
                    >
                      {!isSys && (
                        <span className="text-[9px] font-bold text-slate-500 tracking-wide mb-0.5">
                          {c.sender} • {c.timestamp.substring(0, 5)}
                        </span>
                      )}
                      <div
                        className={`p-2.5 rounded-2xl text-[11px] leading-relaxed font-medium ${
                          isSys
                            ? "bg-slate-950/30 border border-slate-850/40 text-slate-400 italic font-normal text-[9px] rounded-lg w-full"
                            : isMe
                            ? "bg-amber-500 text-slate-950 rounded-tr-none font-semibold"
                            : "bg-slate-850 border border-slate-800 text-slate-250 rounded-tl-none"
                        }`}
                      >
                        {c.message}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
                <input
                  type="text"
                  placeholder="Send message..."
                  maxLength={60}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-[11px] font-medium placeholder-slate-600 outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold p-2.5 rounded-xl transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
