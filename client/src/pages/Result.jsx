import React from "react";
import { useGameStore } from "../store/gameStore";
import { Award, Trophy, Home, Percent, RotateCcw, Target, Crown } from "lucide-react";
import { motion } from "framer-motion";

// Lightweight, pure Framer Motion Confetti Particle Stream
const Confetti = () => {
  const colors = ["bg-amber-400", "bg-red-500", "bg-blue-400", "bg-emerald-400", "bg-pink-400", "bg-purple-400"];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: 45 }).map((_, i) => {
        const size = Math.random() * 8 + 5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        const delay = Math.random() * 4;
        const duration = Math.random() * 2.5 + 2.5;
        return (
          <motion.div
            key={i}
            className={`absolute ${color} rounded-sm opacity-80`}
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              top: -20
            }}
            animate={{
              y: ["0vh", "110vh"],
              rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
              x: ["0px", `${(Math.random() - 0.5) * 80}px`]
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
              delay: delay,
              ease: "linear"
            }}
          />
        );
      })}
    </div>
  );
};

export default function Result({ onNavigate }) {
  const { gameState, leaveRoomOnline, leaveRoomOffline, isOffline } = useGameStore();

  if (!gameState) return null;

  const { scores, roundHistory, maxRounds, players } = gameState;

  // Gather stats for all players
  const playerStats = players.map((p) => {
    const playerScores = scores[p.id] || [];
    const totalScore = playerScores.reduce((sum, v) => sum + v, 0);
    
    let totalTricks = 0;
    let correctGuesses = 0;

    for (const history of roundHistory) {
      const bid = history.bids[p.id];
      const won = history.tricksWon[p.id];
      
      if (won !== undefined) {
        totalTricks += won;
      }
      
      if (bid !== undefined && won !== undefined && bid === won) {
        correctGuesses += 1;
      }
    }

    const totalPlayedRounds = roundHistory.length || 1;
    const accuracy = Math.round((correctGuesses / totalPlayedRounds) * 100);

    return {
      id: p.id,
      name: p.name,
      totalScore,
      totalTricks,
      correctGuesses,
      accuracy
    };
  });

  // Sort descending by score to rank players
  playerStats.sort((a, b) => b.totalScore - a.totalScore);

  const handleReturnHome = () => {
    if (isOffline) {
      leaveRoomOffline();
    } else {
      leaveRoomOnline();
    }
    onNavigate("home");
  };

  const getRankBadge = (rank) => {
    if (rank === 0) return <Trophy className="w-5 h-5 text-amber-400 fill-amber-500/10" />;
    if (rank === 1) return <Award className="w-5 h-5 text-slate-350 fill-slate-300/10" />;
    if (rank === 2) return <Award className="w-5 h-5 text-amber-700 fill-amber-800/10" />;
    return <span className="text-xs font-black text-slate-500">#{rank + 1}</span>;
  };

  const getPodiumMedalText = (rank) => {
    if (rank === 0) return "🥇";
    if (rank === 1) return "🥈";
    if (rank === 2) return "🥉";
    return "";
  };

  const getRowBg = (rank) => {
    if (rank === 0) return "bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/35 shadow-[0_0_15px_rgba(245,158,11,0.05)]";
    if (rank === 1) return "bg-gradient-to-r from-slate-300/5 to-transparent border-slate-350/15";
    if (rank === 2) return "bg-gradient-to-r from-amber-800/5 to-transparent border-amber-800/15";
    return "bg-slate-900/10 border-slate-850/50";
  };

  return (
    <div className="min-h-screen flex flex-col justify-between py-8 px-4 bg-slate-950 relative overflow-hidden select-none">
      {/* Confetti Overlay */}
      <Confetti />

      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-amber-950/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg mx-auto flex flex-col gap-6 my-auto z-10">
        {/* Header */}
        <div className="text-center relative">
          <h1 className="text-4xl font-black tracking-widest text-amber-500 uppercase drop-shadow-lg">
            🏆 FINAL RESULTS
          </h1>
          <p className="text-slate-500 text-[10px] tracking-widest mt-1.5 uppercase font-bold">
            Standings, Predict accuracy & stats
          </p>
        </div>

        {/* Podium Grand Champion Showcase */}
        {playerStats.length > 0 && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1.0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className="glass-panel p-6 rounded-3xl border border-amber-500/40 bg-gradient-to-b from-amber-500/15 via-slate-900/70 to-slate-900/90 text-center shadow-[0_0_35px_rgba(245,158,11,0.25)] relative overflow-hidden"
          >
            {/* Crown Indicator */}
            <div className="absolute top-3 right-3 flex items-center justify-center p-1 bg-amber-500/10 border border-amber-500/20 rounded-full animate-pulse">
              <Crown className="w-4 h-4 text-amber-400" />
            </div>

            <Trophy className="w-14 h-14 text-amber-400 mx-auto mb-2 animate-bounce" />
            
            <span className="text-[10px] font-black text-amber-500 tracking-widest uppercase block mb-1">
              👑 GRAND CHAMPION 👑
            </span>
            <h2 className="text-2.5xl font-black text-slate-100 tracking-wide">
              {playerStats[0].name}
            </h2>
            
            <div className="h-[1px] w-24 bg-amber-500/20 mx-auto my-3" />
            
            <div className="flex justify-center gap-8 text-xs text-slate-400">
              <div>
                <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-wide">FINAL SCORE</span>
                <span className="text-amber-400 font-black text-lg">{playerStats[0].totalScore}</span>
              </div>
              <div className="border-l border-slate-800/80" />
              <div>
                <span className="block text-[9px] text-slate-500 font-extrabold uppercase tracking-wide">PREDICT ACCURACY</span>
                <span className="text-emerald-400 font-black text-lg">{playerStats[0].accuracy}%</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Leaderboard list */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-850 shadow-xl flex flex-col gap-3">
          <span className="block text-slate-450 text-[10px] font-black tracking-widest uppercase mb-1">
            LEADERBOARD STANDINGS
          </span>

          <div className="flex flex-col gap-2.5">
            {playerStats.map((player, rank) => (
              <div
                key={player.id}
                className={`flex justify-between items-center p-3.5 rounded-2xl border ${getRowBg(rank)} transition-all`}
              >
                {/* Profile Details */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-950 border border-slate-850 flex justify-center items-center font-bold">
                    {getRankBadge(rank)}
                  </div>
                  <div>
                    <span className="flex items-center gap-1 text-xs font-black text-slate-100 uppercase">
                      {getPodiumMedalText(rank)} {player.name}
                    </span>
                    <span className="text-[9px] text-slate-550 font-bold uppercase tracking-tight">
                      Tricks: {player.totalTricks} • Bids hit: {player.correctGuesses}
                    </span>
                  </div>
                </div>

                {/* Score / Accuracy */}
                <div className="text-right flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className="text-[7.5px] text-slate-500 font-black uppercase">ACCURACY</span>
                    <span className="text-[10px] font-black text-slate-200 flex items-center gap-0.5">
                      <Target className="w-3 h-3 text-emerald-500" />
                      {player.accuracy}%
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-end border-l border-slate-800/80 pl-3">
                    <span className="text-[7.5px] text-slate-500 font-black uppercase">SCORE</span>
                    <span className="text-sm font-black text-amber-500">
                      {player.totalScore}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Return Button */}
        <button
          onClick={handleReturnHome}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 text-slate-950 font-black py-4 px-6 rounded-2xl shadow-lg shadow-amber-500/10 hover:shadow-amber-500/25 transition-all text-xs tracking-widest outline-none uppercase flex justify-center items-center gap-1.5"
        >
          <Home className="w-4 h-4 fill-slate-950" /> BACK TO MAIN LOBBY
        </button>
      </div>
    </div>
  );
}
