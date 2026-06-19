import { io } from "socket.io-client";

// Dynamically resolve socket URL for local network, localhost, and production
const getSocketUrl = () => {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:5000";
  }
  
  // If accessing via local network IP (e.g. 192.168.x.x or 10.x.x.x), connect to the same IP on port 5000
  if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return `http://${hostname}:5000`;
  }
  
  return import.meta.env.VITE_SOCKET_URL || "https://kachuful-server.onrender.com";
};

const SOCKET_URL = getSocketUrl();
console.log(`[Socket] Initializing connection to URL: ${SOCKET_URL}`);

// Create socket connection. Do not connect automatically.
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});
