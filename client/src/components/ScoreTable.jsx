import React from "react";
import { useGameStore } from "../store/gameStore";
import { getTrumpSymbol } from "../utils/gameEngine";
import { Play } from "lucide-react";

export default function ScoreTable({ isModal = false }) {
  const { gameState, players, isOffline, continueRoundOffline, continueRoundOnline, accessibilityMode, isSpectator } = useGameStore();

  if (!gameState) return null;

  const { scores, roundHistory, maxRounds, round: currentRound, scoreMode } = gameState || {};

  // Compute total scores
  const totalScores = {};
  for (const player of (gameState?.players || [])) {
    totalScores[player.id] = (scores?.[player.id] || []).reduce((sum, val) => sum + val, 0);
  }

  // Get score style / colors
  const getSuitColor = (suit) => {
    if (suit === "HEART" || suit === "DIAMOND") return "text-red-500 font-bold";
    return "text-slate-300 font-bold";
  };

  const getSuitLabel = (suit) => {
    const sym = getTrumpSymbol(suit);
    if (accessibilityMode) {
      return `${suit.substring(0, 5)} ${sym}`;
    }
    return sym;
  };

  const handleContinue = () => {
    if (isOffline) {
      continueRoundOffline();
    } else {
      continueRoundOnline();
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Glassmorphism Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {(gameState?.players || []).map((p) => {
          const isWinner = totalScores[p.id] === Math.max(...Object.values(totalScores || {}));
          return (
            <div
              key={p.id}
              className={`p-3 rounded-2xl border backdrop-blur-md flex flex-col items-center text-center transition-all ${
                isWinner
                  ? "bg-amber-500/10 border-amber-500/30 shadow-lg shadow-amber-500/5"
                  : "bg-slate-950/40 border-slate-850"
              }`}
            >
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest truncate max-w-[80px] mb-1">
                {p.name}
              </span>
              <span className="text-xl font-black text-slate-100">{totalScores[p.id]}</span>
              <span className="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5">
                TOTAL PTS
              </span>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-850 bg-slate-950/45 backdrop-blur-md no-scrollbar shadow-inner shadow-black/40">
        <table className="w-full text-center border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-850 text-[10px] tracking-wider text-slate-400 uppercase">
              <th className="py-3 px-3 text-left font-bold border-r border-slate-850 w-24">
                TRUMP / RD
              </th>
              {(gameState?.players || []).map((p) => (
                <th key={p.id} className="py-3 px-2 font-extrabold border-r border-slate-850 min-w-24">
                  <div className="flex flex-col items-center">
                    <span className="truncate max-w-[80px]">{p.name}</span>
                    <span className="text-[9px] text-amber-500 font-bold">
                      {totalScores[p.id]} PTS
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Rows for rounds */}
            {Array.from({ length: maxRounds }).map((_, idx) => {
              const rNum = idx + 1;
              const rHistory = (roundHistory || []).find((h) => h.round === rNum);
              // Calculate trump for this round dynamically
              const rTrump = getTrumpForRoundLocal(rNum);
              const isPast = rNum < currentRound || (rNum === currentRound && gameState?.phase === "roundEnd");
              const isCurrent = rNum === currentRound && gameState?.phase !== "roundEnd";
 
              return (
                <tr
                  key={rNum}
                  className={`border-b border-slate-850 hover:bg-slate-900/20 transition-all ${
                    isCurrent ? "bg-amber-500/5 font-semibold text-amber-400 border-l-2 border-l-amber-500" : ""
                  } ${!isPast && !isCurrent ? "opacity-35" : ""}`}
                >
                  {/* Round & Trump Column */}
                  <td className="py-2.5 px-3 text-left border-r border-slate-850 font-bold flex items-center gap-1.5 h-10">
                    <span className={getSuitColor(rTrump)}>
                      {getSuitLabel(rTrump)}
                    </span>
                    <span className="text-[10px] text-slate-400">R{rNum}</span>
                  </td>
 
                  {/* Player Scores Columns */}
                  {(gameState?.players || []).map((p) => {
                    const playerScores = scores?.[p.id] || [];
                    const score = playerScores[idx];
                    const hasScore = score !== undefined;
                    
                    // Retrieve bid & won for this round from history
                    const bid = rHistory?.bids?.[p.id];
                    const won = rHistory?.tricksWon?.[p.id];
 
                    return (
                      <td key={p.id} className="py-2.5 px-2 border-r border-slate-850">
                        {hasScore ? (
                          <div className="flex flex-col items-center justify-center">
                            <span className={`font-bold ${score > 0 ? "text-emerald-400" : "text-slate-400"}`}>
                              {score}
                            </span>
                            {bid !== undefined && won !== undefined && (
                              <span className="text-[9px] text-slate-500 font-medium">
                                ({won}/{bid})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-650">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
 
            {/* Total Row */}
            <tr className="bg-slate-950 font-extrabold text-slate-200 border-t border-slate-850">
              <td className="py-3 px-3 text-left border-r border-slate-850 text-[10px] tracking-wider uppercase text-amber-500 font-bold">
                TOTAL
              </td>
              {(gameState?.players || []).map((p) => (
                <td key={p.id} className="py-3 px-2 border-r border-slate-850 text-amber-400 text-sm">
                  {totalScores[p.id]}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Continue button for modal roundEnd phase */}
      {isModal && gameState.phase === "roundEnd" && !isSpectator && (
        <button
          onClick={handleContinue}
          className="w-full mt-3 bg-gradient-to-r from-amber-500 via-amber-450 to-amber-550 text-slate-950 font-black py-4 px-6 rounded-2xl shadow-lg shadow-amber-500/20 transition-all duration-300 transform active:scale-98 hover:shadow-amber-500/35 animate-pulse text-sm uppercase tracking-wider outline-none accessibility-focus flex justify-center items-center gap-2"
        >
          <Play className="w-4.5 h-4.5 fill-slate-950" /> CONTINUE GAME
        </button>
      )}
    </div>
  );
}

// Local helper to calculate trump since getTrumpForRound isn't fully global
function getTrumpForRoundLocal(round) {
  const suits = ["SPADE", "HEART", "CLUB", "DIAMOND"];
  return suits[(round - 1) % suits.length];
}
