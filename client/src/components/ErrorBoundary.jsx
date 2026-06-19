import React from "react";
import { AlertTriangle, Home } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReturnToLobby = () => {
    // Clear room session storage and redirect
    sessionStorage.removeItem("activeRoomCode");
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center select-none relative">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-950/10 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="w-16 h-16 bg-red-950/20 border border-red-500/30 text-red-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-200 tracking-wider mb-2 uppercase">Unable to load game</h2>
          <p className="text-slate-400 text-xs max-w-xs mb-6 leading-relaxed">
            A rendering error occurred during gameplay. Please return to the lobby to restart or rejoin.
          </p>
          {this.state.error && (
            <div className="w-full max-w-md p-3 mb-6 bg-slate-900/80 border border-slate-800 rounded-xl text-left overflow-x-auto text-[10px] font-mono text-red-400 no-scrollbar">
              {this.state.error.toString()}
            </div>
          )}
          <button
            onClick={this.handleReturnToLobby}
            className="flex items-center gap-1.5 px-6 py-3 bg-amber-500 hover:bg-amber-450 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/10 outline-none"
          >
            <Home className="w-3.5 h-3.5" /> Return to Lobby
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
