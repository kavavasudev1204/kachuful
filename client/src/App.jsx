import React, { useEffect, lazy, Suspense } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { useGameStore } from "./store/gameStore";
import { socket } from "./socket/socket";
import ErrorBoundary from "./components/ErrorBoundary";

// Lazy load page components for bundle size optimization
const Home = lazy(() => import("./pages/Home"));
const Lobby = lazy(() => import("./pages/Lobby"));
const GameBoard = lazy(() => import("./pages/GameBoard"));
const Result = lazy(() => import("./pages/Result"));

export default function App() {
  const { roomCode, status, accessibilityMode, isOffline, connectSocket } = useGameStore();
  const navigate = useNavigate();

  // Connect socket on app mount
  useEffect(() => {
    connectSocket();
  }, [connectSocket]);

  // Reactive routing based on game status and room code
  useEffect(() => {
    if (!roomCode) {
      navigate("/");
    } else if (status === "playing") {
      navigate(`/game/${roomCode}`);
    } else if (status === "waiting") {
      navigate("/lobby");
    } else if (status === "finished") {
      navigate("/result");
    }
  }, [roomCode, status, navigate]);

  // On mount, auto-rejoin if active room and name exist in session/local storage
  useEffect(() => {
    const activeRoomCode = sessionStorage.getItem("activeRoomCode");
    const playerName = sessionStorage.getItem("playerName") || localStorage.getItem("playerName");
    if (activeRoomCode && playerName && !isOffline) {
      const { joinRoomOnline, roomCode: currentRoom } = useGameStore.getState();
      if (!currentRoom) {
        console.log(`[App Mount] Found active room session: ${activeRoomCode}. Auto-joining...`);
        joinRoomOnline(activeRoomCode, playerName);
      }
    }
  }, [isOffline]);

  // Accessibility toggle styling injection
  useEffect(() => {
    if (accessibilityMode) {
      document.documentElement.classList.add("accessibility-mode");
    } else {
      document.documentElement.classList.remove("accessibility-mode");
    }
  }, [accessibilityMode]);

  const handleNavigate = (page) => {
    if (page === "home") {
      navigate("/");
    } else if (page === "lobby") {
      navigate("/lobby");
    } else if (page === "game") {
      navigate(`/game/${roomCode}`);
    } else if (page === "result") {
      navigate("/result");
    }
  };

  return (
    <div className={`min-h-screen ${accessibilityMode ? "contrast-125" : ""}`}>
      <Suspense fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-slate-400 gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-black tracking-widest uppercase text-amber-500/80 animate-pulse">Loading Kachuful...</span>
        </div>
      }>
        <Routes>
          <Route path="/" element={<Home onNavigate={handleNavigate} />} />
          <Route path="/lobby" element={<Lobby onNavigate={handleNavigate} />} />
          <Route path="/game/:roomCode" element={
            <ErrorBoundary>
              <GameBoard onNavigate={handleNavigate} />
            </ErrorBoundary>
          } />
          <Route path="/result" element={<Result onNavigate={handleNavigate} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </div>
  );
}
