import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import registerSocketHandlers from "./socket/socketHandler.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: "*", // Allow all origins for easier testing/development
  methods: ["GET", "POST"]
}));

app.use(express.json());

// Basic Health Check Endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", game: "Kachuful (Judgement)" });
});

const httpServer = createServer(app);

// Initialize Socket.IO Server
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Register Socket events
registerSocketHandlers(io);


// --- MongoDB Setup ---
const mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
  console.log("Loaded MONGODB_URI:", process.env.MONGODB_URI);
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
    .then(() => console.log("[Server] Connected to MongoDB"))
    .catch(err => console.error("[Server] MongoDB connection error:", err));
} else {
  console.log("[Server] No MONGODB_URI provided. Running purely with In-Memory room management.");
}

// --- Start Server ---
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[Server] Kachuful Server running on port ${PORT} (exposing to local network on http://10.41.34.76:${PORT})`);
});
