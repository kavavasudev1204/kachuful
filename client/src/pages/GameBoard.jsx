import React, { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { determineTrickWinner } from "../utils/gameEngine";
import ScoreTable from "../components/ScoreTable";
import { Send, MessageSquare, Menu, Award, Sparkles, RefreshCw, X, ShieldAlert, Volume2, VolumeX, AlertTriangle, Home, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "../utils/soundEffects";

// High-quality SVG Suit Icon Renderers
const SpadeIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C11.5 2 6 8.5 6 12.5c0 3 2 4.5 4.5 4.5a3.8 3.8 0 001.5-.3V21c-1 0-2 .5-2 1.5h7c0-1-1-1.5-2-1.5v-4.3a3.8 3.8 0 001.5.3c2.5 0 4.5-1.5 4.5-4.5 0-4-5.5-10.5-6-10.5z" />
  </svg>
);

const HeartIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const ClubIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 9.5a3 3 0 10-2.8-4c-.3.4-.2.9.2 1.2.4.3.9.2 1.2-.2.3-.4.8-.5 1.4-.5a1.5 1.5 0 010 3 1 1 0 00-1 1v4.3c-.6-.3-1.3-.5-2-.5a2.5 2.5 0 102.3 3.5c.3-.4.2-.9-.2-1.2a.8.8 0 00-1.2.2 1 1 0 01-1.4.1 1 1 0 011-.1c.7 0 1.3.2 2 .5V21c0 .5-.5 1-1 1h4c-.5 0-1-.5-1-1v-4.3c.7-.3 1.3-.5 2-.5a2.5 2.5 0 100-5c-.7 0-1.4.2-2 .5V10c0-.5-.5-1-1-1z" />
  </svg>
);

const DiamondIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L3.5 12 12 22l8.5-10L12 2z" />
  </svg>
);

const renderSuitIcon = (suit, className = "w-4 h-4") => {
  switch (suit) {
    case "SPADE": return <SpadeIcon className={className} />;
    case "HEART": return <HeartIcon className={className} />;
    case "CLUB": return <ClubIcon className={className} />;
    case "DIAMOND": return <DiamondIcon className={className} />;
    default: return null;
  }
};

export default function GameBoard({ onNavigate }) {
  const { roomCode: paramRoomCode } = useParams();
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
    clearError,
    setPlayerName,
    joinRoomOnline,
    isConnected
  } = useGameStore();

  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [selectedBid, setSelectedBid] = useState(null);
  const [cardPlayError, setCardPlayError] = useState("");
  const [muted, setMuted] = useState(sounds.isMuted());
  const [namePromptInput, setNamePromptInput] = useState("");
  const [isPortrait, setIsPortrait] = useState(false);
  const [isDealAnimating, setIsDealAnimating] = useState(false);
  
  const chatEndRef = useRef(null);

  // Monitor orientation shifts
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  // Set deal animation timer when round changes or hand fills
  useEffect(() => {
    const handLength = gameState?.hands?.[myPlayerId]?.length || 0;
    if (handLength > 0) {
      setIsDealAnimating(true);
      const timer = setTimeout(() => {
        setIsDealAnimating(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [round, gameState?.hands?.[myPlayerId]?.length]);

  // Auto-scroll chat drawer
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

  // Reconnection logic
  useEffect(() => {
    if (paramRoomCode && paramRoomCode !== "OFFLINE" && !isOffline) {
      const savedName = localStorage.getItem("playerName") || useGameStore.getState().playerName;
      if (savedName && roomCode !== paramRoomCode) {
        console.log(`[GameBoard Mount] Auto-rejoining room ${paramRoomCode} as ${savedName}`);
        joinRoomOnline(paramRoomCode, savedName);
      }
    }
  }, [paramRoomCode, roomCode, joinRoomOnline, isOffline]);

  // Portrait Lock Overlay
  if (isPortrait) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex flex-col justify-center items-center text-center p-6 text-slate-100 select-none">
        <motion.div
          animate={{ rotate: [0, 90, 90, 0, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", times: [0, 0.4, 0.6, 1, 1] }}
          className="w-20 h-20 bg-slate-900 border border-slate-800 text-amber-500 rounded-3xl flex items-center justify-center mb-6 shadow-xl"
        >
          <RefreshCw className="w-10 h-10" />
        </motion.div>
        <h2 className="text-xl font-extrabold text-slate-200 tracking-wider mb-2 uppercase">Landscape Required</h2>
        <p className="text-slate-400 text-sm max-w-xs mb-1 font-medium">
          Please rotate your device to Landscape Mode
        </p>
        <span className="text-amber-500 text-lg font-black mt-2 tracking-widest animate-pulse">
          🡺 Landscape Required
        </span>
      </div>
    );
  }

  const showNamePrompt = paramRoomCode && paramRoomCode !== "OFFLINE" && !isOffline && !localStorage.getItem("playerName") && !roomCode;

  if (showNamePrompt) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden select-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-950/15 rounded-full blur-[100px] pointer-events-none" />
        
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-slate-800 shadow-2xl relative text-center"
        >
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-amber-500/30" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-500/30" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-amber-500/30" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-500/30" />

          <h2 className="text-xl font-extrabold text-amber-500 tracking-wider mb-2">JOIN ROOM {paramRoomCode}</h2>
          <p className="text-slate-400 text-xs mb-6">Enter your player name to enter the game</p>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!namePromptInput.trim()) return;
            const name = namePromptInput.trim();
            setPlayerName(name);
            joinRoomOnline(paramRoomCode, name);
          }} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="e.g. Vasudev"
              maxLength={15}
              value={namePromptInput}
              onChange={(e) => setNamePromptInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-650 font-medium tracking-wide outline-none transition-all duration-200"
            />
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg transition-all text-xs tracking-wider"
            >
              JOIN GAME
            </button>
            <button
              type="button"
              onClick={() => onNavigate("home")}
              className="text-xs text-slate-500 hover:text-slate-400 underline mt-1"
            >
              Go Back Home
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Connection Lost Screen
  if (!isConnected && !isOffline) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-red-950/20 border border-red-500/30 text-red-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-200 tracking-wider mb-2">CONNECTION LOST</h2>
        <p className="text-slate-400 text-xs max-w-xs mb-6 leading-relaxed">
          The connection to the Kachuful server was interrupted. Attempting to reconnect automatically...
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Force Refresh
          </button>
          <button
            onClick={() => onNavigate("home")}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-450 text-slate-950 rounded-xl text-xs font-bold transition-all"
          >
            <Home className="w-3.5 h-3.5" /> Return Home
          </button>
        </div>
      </div>
    );
  }

  // Room Error or Closed
  if (errorMessage && (errorMessage.includes("Room not found") || errorMessage.includes("closed"))) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-amber-950/20 border border-amber-500/30 text-amber-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-200 tracking-wider mb-2">ROOM INACTIVE</h2>
        <p className="text-slate-400 text-xs max-w-xs mb-6 leading-relaxed">
          {errorMessage}
        </p>
        <button
          onClick={() => {
            clearError();
            onNavigate("home");
          }}
          className="flex items-center gap-1.5 px-6 py-3 bg-amber-500 hover:bg-amber-450 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/10"
        >
          <Home className="w-3.5 h-3.5" /> Return to Lobby Selection
        </button>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 text-slate-200">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-4" />
        <span className="text-xs font-black tracking-widest text-slate-400 uppercase">Synchronizing Game State...</span>
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

  // Bidding restriction
  const priorBidsSum = Object.values(bids).reduce((sum, v) => sum + v, 0);
  const bidsCount = Object.keys(bids).length;
  const isLastBidder = bidsCount === gameState.players.length - 1;
  const forbiddenBid = isLastBidder && settings.enableLastBidRestriction
    ? cardsPerPlayer - priorBidsSum
    : null;

  // Legal card check
  const isCardPlayable = (card) => {
    if (!isMyTurn || phase !== "playing") return false;
    if (playedCards.length === 0) return true;
    const leadSuit = playedCards[0]?.card?.suit;
    if (!leadSuit) return true;
    if (card.suit === leadSuit) return true;
    const hasLeadSuit = myHand.some(c => c.suit === leadSuit);
    return !hasLeadSuit;
  };

  // Seating
  const N = gameState.players.length;
  const myIndex = gameState.players.findIndex(p => p.id === myPlayerId);
  const orderedPlayers = [];
  for (let i = 0; i < N; i++) {
    const offsetIndex = (myIndex + i) % N;
    orderedPlayers.push(gameState.players[offsetIndex >= 0 ? offsetIndex : 0]);
  }

  const getSeatingAngles = (total) => {
    switch (total) {
      case 2:
        return [90, 270];
      case 3:
        return [90, 210, 330];
      case 4:
        return [90, 180, 270, 360];
      case 5:
        return [90, 162, 234, 306, 18];
      case 6:
        return [90, 150, 210, 270, 330, 30];
      default:
        const angles = [];
        for (let i = 0; i < total; i++) {
          angles.push(90 + (i * 360) / total);
        }
        return angles;
    }
  };

  const getPolarCoords = (index, total) => {
    const angles = getSeatingAngles(total);
    const angle = angles[index % total];
    const rad = (angle * Math.PI) / 180;
    // 68% radius to place player avatars outside the 50% felt table border
    return {
      left: `calc(50% + ${68 * Math.cos(rad)}%)`,
      top: `calc(50% + ${68 * Math.sin(rad)}%)`,
      angle
    };
  };

  // Table card coordinates
  const getPlayedCardOffset = (playerId) => {
    const idx = orderedPlayers.findIndex(p => p.id === playerId);
    if (idx === -1) return { x: 0, y: 0, rotate: 0 };
    const angles = getSeatingAngles(N);
    const angle = angles[idx % N];
    const rad = (angle * Math.PI) / 180;
    return {
      x: 55 * Math.cos(rad),
      y: 55 * Math.sin(rad),
      rotate: ((idx * 6) % 14) - 7
    };
  };

  // Player Seat throw initial coordinate
  const getPlayedCardInitialOffset = (playerId) => {
    const idx = orderedPlayers.findIndex(p => p.id === playerId);
    if (idx === -1) return { x: 0, y: 0 };
    const angles = getSeatingAngles(N);
    const angle = angles[idx % N];
    const rad = (angle * Math.PI) / 180;
    return {
      x: 180 * Math.cos(rad),
      y: 180 * Math.sin(rad)
    };
  };

  // Colors
  const getSuitColor = (suit) => {
    if (suit === "HEART" || suit === "DIAMOND") return "text-red-650";
    return "text-slate-950";
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

  // Card dimensions ratios
  const widthClass = "w-[85px] sm:w-[120px]";
  const heightClass = "h-[120px] sm:h-[170px]";
  const tableWidthClass = "w-[55px] sm:w-[75px]";
  const tableHeightClass = "h-[80px] sm:h-[110px]";

  // Fan calculations
  const getFanStyle = (idx, total) => {
    if (total <= 1) return { x: 0, y: 0, rotate: 0 };
    const maxSpread = Math.min(60, (total - 1) * (total > 8 ? 6 : 8)); 
    const startAngle = -maxSpread / 2;
    const angleStep = maxSpread / (total - 1);
    const rotate = startAngle + idx * angleStep;
    
    const centerIdx = (total - 1) / 2;
    const distanceFromCenter = idx - centerIdx;
    
    const horizontalSpacing = total > 10 ? 18 : total > 7 ? 24 : 32;
    const xOffset = distanceFromCenter * horizontalSpacing;
    const archHeightMultiplier = total > 10 ? 1.5 : 2.5;
    const yOffset = Math.pow(distanceFromCenter, 2) * archHeightMultiplier;
    
    return {
      x: xOffset,
      y: yOffset,
      rotate: rotate
    };
  };

  // Realistic Card Graphic Component with shine
  const renderCardGraphic = (card, sizeClass = "w-[75px] h-[110px]") => {
    const isRed = card.suit === "HEART" || card.suit === "DIAMOND";
    const suitColor = isRed ? "text-red-650" : "text-slate-950";
    return (
      <div className={`bg-white border border-slate-300 rounded-[10px] flex flex-col justify-between p-2 select-none relative shadow-[0_4px_12px_rgba(0,0,0,0.18)] shrink-0`}
           style={{ color: isRed ? "#dc2626" : "#020617" }}
      >
        {/* Glossy sheen reflection */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent opacity-75 pointer-events-none rounded-[10px]"
             style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%)" }} />

        <div className="flex flex-col items-center leading-none self-start scale-85 origin-top-left">
          <span className="text-xs sm:text-sm font-black text-slate-950">{card.rank}</span>
          <span className="mt-0.5">{renderSuitIcon(card.suit, "w-3 h-3")}</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 sm:w-10 sm:h-10">
            {renderSuitIcon(card.suit, "w-full h-full")}
          </div>
        </div>
        <div className="flex flex-col items-center leading-none self-end transform rotate-180 scale-85 origin-bottom-right">
          <span className="text-xs sm:text-sm font-black text-slate-950">{card.rank}</span>
          <span className="mt-0.5">{renderSuitIcon(card.suit, "w-3 h-3")}</span>
        </div>
      </div>
    );
  };

  // Trump card renderer supporting Spade/Club black specifications
  const renderTrumpCard = (suit, isLarge = false) => {
    const isRed = suit === "HEART" || suit === "DIAMOND";
    const suitColor = isRed ? "text-red-650" : "text-slate-950";
    const cardSizeClass = isLarge 
      ? "w-[85px] h-[120px] sm:w-[105px] sm:h-[150px] shadow-[0_0_30px_rgba(245,158,11,0.85)] border-amber-400 animate-pulse" 
      : "w-[75px] h-[110px] shadow-lg border-slate-350";

    return (
      <div className={`bg-white border rounded-[10px] flex flex-col justify-between p-2.5 select-none relative shrink-0 transition-all ${cardSizeClass}`}
           style={{ color: isRed ? "#dc2626" : "#020617" }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent opacity-75 pointer-events-none rounded-[10px]"
             style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%)" }} />

        <div className="flex flex-col items-center leading-none self-start scale-90 origin-top-left">
          <span className="text-xs sm:text-sm font-black text-slate-950">A</span>
          <span className="mt-0.5">{renderSuitIcon(suit, "w-3.5 h-3.5")}</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 sm:w-11 sm:h-11">
            {renderSuitIcon(suit, "w-full h-full")}
          </div>
        </div>
        <div className="flex flex-col items-center leading-none self-end transform rotate-180 scale-90 origin-bottom-right">
          <span className="text-xs sm:text-sm font-black text-slate-950">A</span>
          <span className="mt-0.5">{renderSuitIcon(suit, "w-3.5 h-3.5")}</span>
        </div>
      </div>
    );
  };

  const winningPlay = determineTrickWinner({ playedCards, activeTrump: trump });
  const deckSize = gameState.deck?.length ?? (52 - (N * round));

  return (
    <div className="h-screen max-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 relative overflow-hidden select-none">
      {/* Background radial overlays */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-950/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Top HUD */}
      <div className="w-full px-4 py-3 bg-slate-900/60 border-b border-slate-900/60 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={handleExitGame}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-slate-100 rounded-xl text-xs font-bold transition-all outline-none"
          >
            EXIT GAME
          </button>
          <div className="flex flex-col text-[10px] tracking-wide text-slate-500 font-bold uppercase">
            <span>Room Code</span>
            <span className="text-slate-300 text-xs font-extrabold select-all">{roomCode}</span>
          </div>
        </div>

        {/* Round information */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Round</span>
            <span className="text-amber-500 font-extrabold text-sm">
              {round} / {maxRounds}
            </span>
          </div>
          <div className="flex flex-col items-center bg-slate-950/60 px-3 py-1 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Trump</span>
            <span className={`text-base font-extrabold flex items-center gap-1.5 ${trump === "HEART" || trump === "DIAMOND" ? "text-red-500" : "text-slate-350"}`}>
              {renderSuitIcon(trump, "w-4.5 h-4.5")}
              {accessibilityMode && <span className="text-xs uppercase text-slate-400 font-medium">({trump.substring(0, 5)})</span>}
            </span>
          </div>
        </div>

        {/* Mute and Chat */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleMute}
            className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl transition-all outline-none"
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl relative transition-all outline-none"
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

      {/* Main Game Table Arena */}
      <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col items-center justify-center relative px-2 py-4">
        {/* Dynamic Turn Announcement HUD Bar */}
        <div className="mb-4 bg-slate-900/60 border border-slate-850 px-6 py-2 rounded-2xl shadow-md backdrop-blur-sm z-20 flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isMyTurn ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-amber-500 shadow-[0_0_10px_#f59e0b]"} animate-ping`} />
          <span className="text-xs font-black tracking-widest uppercase">
            {activePlayer ? (isMyTurn ? "▶ YOUR TURN" : `▶ ${activePlayer.name} TURN`) : "SYNCING"}
          </span>
        </div>

        {/* Circular Table Felt with Weave Felt Texture */}
           {/* TRICK WINNER POPUP MODAL */}
           <AnimatePresence>
             {showWinnerBanner && gameState.lastTrickWinner && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="fixed inset-0 bg-slate-950/80 backdrop-blur-[3px] z-50 flex flex-col justify-center items-center pointer-events-auto"
               >
                 <motion.div
                   initial={{ scale: 0.85, y: 30 }}
                   animate={{ scale: 1.15, y: 0 }}
                   exit={{ scale: 0.85, y: 30 }}
                   className="bg-slate-900/95 border-2 border-amber-500 px-10 py-8 rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.85)] flex flex-col items-center gap-3.5 text-center max-w-sm relative overflow-hidden"
                 >
                   {/* Gold Borders */}
                   <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-500" />
                   <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-500" />
                   <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-500" />
                   <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-500" />
                   
                   <div className="absolute top-0 -inset-full h-full w-1/2 z-50 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/15 opacity-50 animate-shine" />
                   
                   <span className="text-5.5xl animate-bounce">🏆</span>

                   {/* Winner Avatar circle initials */}
                   <div className="w-16 h-16 rounded-full bg-slate-800 border-[2.5px] border-amber-400 flex items-center justify-center text-xl font-black text-amber-400 shadow-md">
                     {gameState.lastTrickWinner.playerName.substring(0, 2).toUpperCase()}
                   </div>

                   <span className="text-3xl font-black text-amber-400 uppercase tracking-widest drop-shadow-md mt-1">
                     {gameState.lastTrickWinner.playerName}
                   </span>
                   
                   <span className="text-[10px] text-slate-300 font-extrabold tracking-widest uppercase mb-1">
                     WON THIS HAND
                   </span>

                   {/* Actual Visual Card Preview */}
                   {renderCardGraphic(gameState.lastTrickWinner.winningCard, "w-[75px] h-[110px]")}
                 </motion.div>
               </motion.div>
             )}
           </AnimatePresence>

        {/* Table Container wrapper that doesn't hide overflow */}
        <div className="relative w-[50vh] h-[50vh] max-w-[340px] max-h-[340px] flex justify-center items-center my-4 z-10">
          {/* Circular Table Felt with Weave Felt Texture */}
          <div className="w-full h-full rounded-full border-[10px] border-amber-800 shadow-[inset_0_0_60px_rgba(0,0,0,0.92),_0_15px_35px_rgba(0,0,0,0.65),_0_0_35px_rgba(59,130,246,0.3)] ring-4 ring-amber-500/25 relative flex justify-center items-center overflow-hidden"
               style={{ background: "radial-gradient(circle, #0e3557 0%, #051629 100%)" }}
          >
            {/* Felt Weave Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.12] pointer-events-none"
                 style={{
                   backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.18) 0%, transparent 80%), repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px), repeating-linear-gradient(90deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)",
                 }} />

            {/* Radial center light source glow */}
            <div className="absolute w-[180px] h-[180px] rounded-full bg-blue-400/10 blur-[40px] pointer-events-none" />

            {/* Deck Stack */}
            <div className="absolute left-[7%] top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-1 z-20 pointer-events-none select-none">
              <div className="relative w-8 h-12 sm:w-9 sm:h-13">
                <div className="absolute top-0 left-0 w-full h-full bg-blue-900 border border-blue-500 rounded-md shadow transform -rotate-6"
                     style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)" }} />
                <div className="absolute top-0.5 left-0.5 w-full h-full bg-blue-900 border border-blue-500 rounded-md shadow transform rotate-3"
                     style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)" }} />
                <div className="absolute top-1 left-1 w-full h-full bg-blue-950 border-2 border-blue-400 rounded-md shadow flex items-center justify-center"
                     style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)" }}>
                  <span className="text-[10px] sm:text-xs text-blue-400 font-bold font-serif">🂠</span>
                </div>
              </div>
              <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider bg-slate-950/80 px-1.5 py-0.5 rounded-full border border-slate-900">
                {deckSize} Cards
              </span>
            </div>

            {/* Trump Card Showcase */}
            <div className="absolute right-[7%] top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-1 z-20 pointer-events-none select-none">
              <span className="text-[8px] font-black uppercase text-amber-500 tracking-wider bg-slate-950/80 px-1.5 py-0.5 rounded-full border border-slate-900">
                Trump
              </span>
              {renderTrumpCard(trump, false)}
            </div>

            {/* Card pile with spring landing and shrink offset */}
            <div className="w-[150px] h-[150px] rounded-full bg-slate-950/5 relative flex justify-center items-center pointer-events-none">
              {playedCards.map((play) => {
                const offset = getPlayedCardOffset(play.playerId);
                const initialOffset = getPlayedCardInitialOffset(play.playerId);
                const isWinningCard = winningPlay && winningPlay.playerId === play.playerId;
                const pName = players.find(p => p.id === play.playerId)?.name || "Bot";
                const isRed = play.card.suit === "HEART" || play.card.suit === "DIAMOND";
                
                return (
                  <motion.div
                    key={play.playerId}
                    initial={{ scale: 1.6, x: initialOffset.x, y: initialOffset.y, rotate: 0 }}
                    animate={{
                      scale: isWinningCard ? 1.2 : 0.95,
                      x: offset.x,
                      y: offset.y,
                      rotate: offset.rotate
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 110,
                      damping: 13,
                      mass: 0.9,
                      duration: 0.45
                    }}
                    className={`absolute ${tableWidthClass} ${tableHeightClass} rounded-xl bg-white border-2 flex flex-col justify-between relative transition-shadow shadow-[0_8px_20px_rgba(0,0,0,0.55)] ${
                      isWinningCard
                        ? "border-amber-400 ring-4 ring-amber-500/50 shadow-[0_0_25px_rgba(234,179,8,0.95)] z-10"
                        : "border-slate-200 z-0"
                    }`}
                    style={{ color: isRed ? "#dc2626" : "#020617" }}
                  >
                    {/* Card glossy reflection overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent opacity-75 pointer-events-none rounded-xl"
                         style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%)" }} />

                    <div className="absolute top-1.5 left-1.5 flex flex-col items-center leading-none scale-85 origin-top-left">
                      <span className="text-xs sm:text-sm font-black text-slate-950">{play.card.rank}</span>
                      <span className="mt-0.5">{renderSuitIcon(play.card.suit, "w-3 h-3")}</span>
                    </div>
                    
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 opacity-95">
                        {renderSuitIcon(play.card.suit, "w-full h-full")}
                      </div>
                    </div>
                    
                    <div className="absolute bottom-1.5 right-1.5 flex flex-col items-center leading-none transform rotate-180 scale-85 origin-bottom-right">
                      <span className="text-xs sm:text-sm font-black text-slate-950">{play.card.rank}</span>
                      <span className="mt-0.5">{renderSuitIcon(play.card.suit, "w-3 h-3")}</span>
                    </div>

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
            </div>
          </div>

          {/* Player Avatars on circles outside the table felt */}
          {orderedPlayers.map((player, idx) => {
            const coords = getPolarCoords(idx, N);
            const isTurn = player.id === activePlayer?.id;
            const playerBid = bids[player.id];
            const hasBid = playerBid !== undefined;
            const playerTricks = tricksWon[player.id] || 0;
            const isMe = player.id === myPlayerId;
            
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
                <div className="flex items-center gap-1 mb-1">
                  <span className={`text-[10px] font-bold tracking-wide truncate max-w-[70px] select-none ${isMe ? "text-amber-400 font-extrabold" : "text-slate-300"}`}>
                    {player.name}
                  </span>
                </div>

                {/* Pulse ring around active player avatar */}
                <div
                  className={`w-11 h-11 rounded-full flex justify-center items-center relative transition-all duration-300 ${
                    isTurn
                      ? "ring-4 ring-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.85)] bg-emerald-950/30"
                      : "ring-2 ring-slate-800 bg-slate-900/90"
                  } ${!player.connected ? "opacity-40" : ""}`}
                >
                  {isTurn && (
                    <div className="absolute inset-[-4px] rounded-full border-2 border-emerald-500 animate-ping opacity-60 pointer-events-none" />
                  )}

                  <span className={`text-xs font-extrabold select-none ${isMe ? "text-amber-400 font-black" : "text-slate-200"}`}>
                    {player.name.substring(0, 2).toUpperCase()}
                  </span>

                  {!player.connected && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 border border-slate-950 rounded-full shadow" />
                  )}
                  {player.connected && isTurn && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border border-slate-950 rounded-full shadow" />
                  )}
                </div>

                {/* Score text */}
                <div className="bg-slate-950/80 border border-slate-850 px-2 py-0.5 rounded-full text-[8px] font-black tracking-wider text-slate-400 mt-1 shadow-sm uppercase">
                  {playerTricks} / {hasBid ? playerBid : "?"}
                </div>

                {!isMe && opponentHandSize > 0 && (
                  <div className="absolute top-[-20px] flex -space-x-1 justify-center pointer-events-none opacity-80 scale-65">
                    {Array.from({ length: opponentHandSize }).map((_, cIdx) => (
                      <div
                        key={cIdx}
                        className="w-3.5 h-5 bg-blue-900 border border-blue-500 rounded-[2px] shadow transform rotate-[-10deg]"
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

      {/* Hand area fanning */}
      <div className={`w-full bg-slate-900/30 border-t border-slate-900/60 pb-8 pt-4 px-4 relative ${phase === "bidding" ? "z-50" : "z-20"}`}>
        
        <div className="max-w-md mx-auto flex justify-between items-center mb-3 text-xs font-bold text-slate-400 select-none">
          <span>YOUR CARDS ({myHand.length})</span>
        </div>

        {/* Fanned arc dealing with 3D spring flips */}
        <div className="w-full max-w-[95vw] sm:max-w-xl h-[150px] sm:h-[190px] mx-auto relative flex justify-center items-end py-4 overflow-visible">
          {myHand.map((card, idx) => {
            const fan = getFanStyle(idx, myHand.length);
            const playable = isCardPlayable(card);
            const isLocked = phase === "playing" && !playable;
            
            // 3D deals with spring bounce impact and tilt
            const targetY = playable ? fan.y - 24 : fan.y;
            const isRed = card.suit === "HEART" || card.suit === "DIAMOND";
            const randomOffset = ((card.value * 7 + card.suit.charCodeAt(0)) % 7) - 3;

            const cardAnimationProps = isDealAnimating ? {
              initial: { x: -280, y: -160, rotateY: 180, scale: 0.4, rotate: 0, opacity: 0 },
              animate: {
                x: fan.x,
                y: targetY,
                rotateY: 0,
                scale: playable ? 1.08 : 1.0,
                rotate: fan.rotate + randomOffset,
                opacity: 1
              },
              transition: {
                type: "spring",
                stiffness: 90,
                damping: 13,
                mass: 0.9,
                delay: idx * 0.08,
                rotateY: { duration: 0.4, ease: "easeInOut", delay: idx * 0.08 + 0.15 }
              }
            } : {
              initial: false,
              animate: {
                x: fan.x,
                y: targetY,
                rotateY: 0,
                scale: playable ? 1.08 : 1.0,
                rotate: fan.rotate + randomOffset,
                opacity: 1
              },
              transition: {
                type: "spring",
                stiffness: 120,
                damping: 15,
                mass: 0.8
              }
            };

            return (
              <motion.button
                key={`${card.suit}-${card.rank}`}
                onClick={() => playable && handlePlayCard(card)}
                disabled={isLocked || phase !== "playing"}
                {...cardAnimationProps}
                whileHover={playable ? {
                  y: targetY - 30,
                  scale: 1.18,
                  zIndex: 100,
                  transition: { duration: 0.2, ease: "easeOut" }
                } : {}}
                className={`absolute bottom-6 left-1/2 -translate-x-1/2 ${widthClass} ${heightClass} rounded-xl shadow-xl border flex flex-col justify-between origin-bottom cursor-pointer select-none transition-all duration-300 transform-style-3d ${
                  playable
                    ? "border-emerald-400 ring-2 ring-emerald-500/20 shadow-[0_0_20px_rgba(34,197,94,0.65)] bg-white playable-card-pulse"
                    : isLocked
                    ? "opacity-35 grayscale cursor-not-allowed border-slate-300 bg-white pointer-events-none"
                    : "border-slate-250 bg-white"
                }`}
                style={{
                  zIndex: idx,
                  color: isRed ? "#dc2626" : "#020617"
                }}
              >
                {/* Glossy card sheen */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent opacity-75 pointer-events-none rounded-xl"
                     style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%)" }} />

                {isLocked && (
                  <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[0.5px] rounded-xl flex flex-col items-center justify-center gap-1 text-slate-350 z-30 pointer-events-none">
                    <span className="text-lg">🔒</span>
                    <span className="text-[9px] font-black uppercase tracking-wider">Locked</span>
                  </div>
                )}

                {playable && (
                  <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-wider z-20 pointer-events-none animate-bounce">
                    Playable
                  </div>
                )}

                <div className="absolute top-2 left-2 flex flex-col items-center leading-none scale-90 origin-top-left">
                  <span className="text-sm sm:text-lg font-black">{card.rank}</span>
                  <span className="mt-0.5">{renderSuitIcon(card.suit, "w-3 h-3 sm:w-4 sm:h-4")}</span>
                </div>

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-8 h-8 sm:w-11 sm:h-11">
                    {renderSuitIcon(card.suit, "w-full h-full")}
                  </div>
                </div>

                <div className="absolute bottom-2 right-2 flex flex-col items-center leading-none transform rotate-180 scale-90 origin-bottom-right">
                  <span className="text-sm sm:text-lg font-black">{card.rank}</span>
                  <span className="mt-0.5">{renderSuitIcon(card.suit, "w-3 h-3 sm:w-4 sm:h-4")}</span>
                </div>
              </motion.button>
            );
          })}

          {myHand.length === 0 && (
            <div className="text-slate-500 text-xs font-semibold tracking-wide uppercase">
              No cards in hand. Waiting for deals...
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
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-45 flex justify-center items-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-slate-800 shadow-2xl relative"
            >
              <h2 className="text-xl font-black text-amber-500 tracking-wider text-center uppercase mb-0.5">
                ROUND {round} FORECAST
              </h2>
              <p className="text-slate-400 text-[10px] text-center uppercase tracking-wider mb-5">
                How many hands will you win?
              </p>

              {/* Trump Showcase Card with large glow display */}
              <div className="mb-5 flex flex-col items-center gap-1.5">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Trump Card</span>
                {renderTrumpCard(trump, true)}
              </div>

              {/* Preview dealt cards */}
              <div className="mb-5">
                <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest text-center mb-1.5">Your Hand Preview</span>
                <div className="flex gap-1.5 justify-center overflow-x-auto py-2 px-1.5 no-scrollbar bg-slate-950/40 rounded-2xl border border-slate-900/60 max-h-20">
                  {myHand.map((card, cIdx) => {
                    const isRed = card.suit === "HEART" || card.suit === "DIAMOND";
                    return (
                      <div
                        key={cIdx}
                        className="w-10 h-14 bg-white border border-slate-250 rounded-[6px] flex flex-col justify-between p-1 shadow-md shrink-0 select-none relative"
                        style={{ color: isRed ? "#dc2626" : "#020617" }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent opacity-75 pointer-events-none rounded-[6px]"
                             style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%)" }} />

                        <div className="flex flex-col items-center leading-none self-start scale-80 origin-top-left">
                          <span className="text-[10px] font-black">{card.rank}</span>
                          <span className="mt-0.5">{renderSuitIcon(card.suit, "w-2.5 h-2.5")}</span>
                        </div>
                        <div className="text-center text-sm leading-none flex items-center justify-center">
                          <div className="w-4.5 h-4.5">
                            {renderSuitIcon(card.suit, "w-full h-full")}
                          </div>
                        </div>
                        <div className="flex flex-col items-center leading-none self-end transform rotate-180 scale-80 origin-bottom-right">
                          <span className="text-[10px] font-black">{card.rank}</span>
                          <span className="mt-0.5">{renderSuitIcon(card.suit, "w-2.5 h-2.5")}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {forbiddenBid !== null && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-[10px] font-bold text-center uppercase tracking-wider leading-relaxed">
                  Last player restriction! <br />
                  You CANNOT bid: <span className="text-sm font-extrabold text-amber-300">{forbiddenBid}</span>
                </div>
              )}

              {/* Grid of bidding options */}
              <div className="grid grid-cols-4 gap-2 mb-2">
                {Array.from({ length: cardsPerPlayer + 1 }).map((_, val) => {
                  const isForbidden = val === forbiddenBid;
                  return (
                    <button
                      key={val}
                      onClick={() => handleBidSubmit(val)}
                      disabled={isForbidden}
                      className="aspect-square bg-slate-900 border border-slate-800 hover:border-amber-500/30 text-slate-100 disabled:opacity-15 disabled:cursor-not-allowed hover:bg-slate-800/80 font-black rounded-xl transition-all flex justify-center items-center text-lg outline-none"
                    >
                      {val}
                    </button>
                  );
                })}
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
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <span className="text-xs font-extrabold tracking-widest text-slate-200 uppercase">
                  CHAT ROOM LOG
                </span>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-slate-400 hover:text-slate-200 outline-none p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

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
