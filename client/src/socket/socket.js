import { io } from "socket.io-client";

// Read from environment variable VITE_SOCKET_URL, fallback to production Render URL.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "https://kachuful-server.onrender.com";

// Create socket connection. Do not connect automatically.
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});
