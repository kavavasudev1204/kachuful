import React, { useEffect } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { useGameStore } from "./store/gameStore";
import { socket } from "./socket/socket";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import GameBoard from "./pages/GameBoard";
import Result from "./pages/Result";

export default function App() {
  const { roomCode, accessibilityMode, setGameState } = useGameStore();
  const navigate = useNavigate();

  // Listen to game-started event exactly as required
  useEffect(() => {
    const handleGameStarted = (gameState) => {
      setGameState(gameState);
      navigate(`/game/${gameState.roomCode}`);
    };

    socket.on("game-started", handleGameStarted);

    return () => {
      socket.off("game-started", handleGameStarted);
    };
  }, [navigate, setGameState]);

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
      <Routes>
        <Route path="/" element={<Home onNavigate={handleNavigate} />} />
        <Route path="/lobby" element={<Lobby onNavigate={handleNavigate} />} />
        <Route path="/game/:roomCode" element={<GameBoard onNavigate={handleNavigate} />} />
        <Route path="/result" element={<Result onNavigate={handleNavigate} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}
