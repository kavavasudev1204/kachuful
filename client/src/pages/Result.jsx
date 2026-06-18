import React from "react";
import { useGameStore } from "../store/gameStore";
import { Award, Trophy, Home, Percent, RotateCcw, Target } from "lucide-react";

export default function Result({ onNavigate }) {
  const { gameState, leaveRoomOnline, leaveRoomOffline, isOffline } = useGameStore();

  if (!gameState) return null;

  const { scores, roundHistory, maxRounds, players } = gameState;

  // 1. Gather stats for all players
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

  // Sort descending by score
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
    return <span className="text-xs font-bold text-slate-500">#{rank + 1}</span>;
  };

  const getRowBg = (rank) => {
    if (rank === 0) return "bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/25";
    if (rank === 1) return "bg-gradient-to-r from-slate-300/5 to-transparent border-slate-350/15";
    if (rank === 2) return "bg-gradient-to-r from-amber-800/5 to-transparent border-amber-800/15";
    return "bg-slate-900/10 border-slate-850/50";
  };

  return (
    <div className="min-h-screen flex flex-col justify-between py-8 px-4 bg-slate-950 relative overflow-hidden select-none">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-amber-950/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg mx-auto flex flex-col gap-6 my-auto z-10">
        {/* Header */}
        <div className="text-center relative">
          <h1 className="text-4xl font-extrabold tracking-widest text-amber-500 animate-pulse">
            🏆 GAME WINNER 🏆
          </h1>
          <p className="text-slate-500 text-xs tracking-wider mt-1 uppercase font-bold">
            Final Standings and Accuracy Rates
          </p>
        </div>

        {/* Podium Winner Showcase (1st Place highlight) */}
        {playerStats.length > 0 && (
          <div className="glass-panel p-6 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-slate-900/60 to-slate-900/80 text-center shadow-xl shadow-amber-500/5">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2 animate-bounce" />
            <span className="text-[10px] font-bold text-amber-500 tracking-widest uppercase block mb-1">
              GRAND CHAMPION
            </span>
            <h2 className="text-2xl font-black text-slate-100 tracking-wide">
              {playerStats[0].name}
            </h2>
            <div className="h-[1px] w-24 bg-amber-500/20 mx-auto my-3" />
            <div className="flex justify-center gap-6 text-xs text-slate-400">
              <div>
                <span className="block text-[10px] text-slate-500 font-bold uppercase">Score</span>
                <span className="text-amber-400 font-extrabold text-base">{playerStats[0].totalScore}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 font-bold uppercase">Accuracy</span>
                <span className="text-amber-400 font-extrabold text-base">{playerStats[0].accuracy}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Ranks Table */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-850 shadow-xl flex flex-col gap-3">
          <span className="block text-slate-400 text-xs font-bold tracking-wider mb-2">
            LEADERBOARD STANDINGS
          </span>

          <div className="flex flex-col gap-2">
            {playerStats.map((player, rank) => (
              <div
                key={player.id}
                className={`flex justify-between items-center p-3.5 rounded-2xl border ${getRowBg(rank)}`}
              >
                {/* Profile/Rank */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-950 border border-slate-800 flex justify-center items-center">
                    {getRankBadge(rank)}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-100">
                      {player.name}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium">
                      Tricks won: {player.totalTricks} • Bids hit: {player.correctGuesses}
                    </span>
                  </div>
                </div>

                {/* Score and Accuracy */}
                <div className="text-right flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] text-slate-500 font-bold uppercase">ACCURACY</span>
                    <span className="text-[10px] font-extrabold text-slate-300 flex items-center gap-0.5">
                      <Target className="w-3 h-3 text-emerald-500" />
                      {player.accuracy}%
                    </span>
                  </div>
                  <div className="flex flex-col items-end border-l border-slate-800/80 pl-3">
                    <span className="text-[8px] text-slate-500 font-bold uppercase">SCORE</span>
                    <span className="text-sm font-extrabold text-amber-500">
                      {player.totalScore}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <button
          onClick={handleReturnHome}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 text-slate-950 font-extrabold py-3.5 px-4 rounded-2xl shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all flex justify-center items-center gap-2 text-sm tracking-wider outline-none accessibility-focus"
        >
          <Home className="w-4 h-4 fill-slate-950" /> BACK TO HOME
        </button>
      </div>
    </div>
  );
}
