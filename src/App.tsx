import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, Video, Map, Save } from "lucide-react";
import { getZoyaResponse, getZoyaAudio, resetZoyaSession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import VideoGenerator from "./components/VideoGenerator";
import InteractiveMap from "./components/InteractiveMap";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "zoya";
  text: string;
  sources?: { title: string; url: string; type?: "web" | "maps" }[];
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("zoya_chat_local_cache");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("zoya_chat_local_cache", JSON.stringify(messages));
  }, [messages]);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [errorType, setErrorType] = useState<string>("PERMISSION_DENIED");
  const [showVideoGenerator, setShowVideoGenerator] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeMap, setActiveMap] = useState<{ origin?: string; destination: string } | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsDictating(true);
    recognition.onend = () => setIsDictating(false);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setTextInput(transcript);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsDictating(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial greeting if no messages exist
    if (messages.length === 0) {
      setMessages([
        { id: "1", sender: "zoya", text: "Namaste! I'm Zoya. How can I entertain you today?" }
      ]);
    }
  }, []);

  const handleDownloadChat = () => {
    if (messages.length === 0) return;
    const conversation = messages
      .map(m => `${m.sender.toUpperCase()}: ${m.text}`)
      .join("\n\n");
    
    const blob = new Blob([conversation], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Zoya_Chat_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  useEffect(() => {
    let watchId: number;
    
    const timer = setTimeout(() => {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => {
            console.warn("Location access declined/failed:", error.message);
          },
          { enableHighAccuracy: false, timeout: 5000 }
        );
      }
    }, 2000);
    
    return () => {
      clearTimeout(timer);
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), sender: "user", text: finalTranscript };
    setMessages((prev) => [...prev, userMsg]);
    
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");
    const commandResult = processCommand(finalTranscript);
    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      const zoyaMsg: ChatMessage = { id: Date.now().toString() + "-z", sender: "zoya", text: responseText };
      setMessages((prev) => [...prev, zoyaMsg]);
      
      if (commandResult.mapData) {
        setActiveMap(commandResult.mapData);
      }

      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }

      setAppState("idle");

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      const zoyaResponse = await getZoyaResponse(finalTranscript, messagesRef.current, userLocation || undefined);
      responseText = zoyaResponse.text;
      
      const zoyaMsg: ChatMessage = { 
        id: Date.now().toString() + "-z", 
        sender: "zoya", 
        text: responseText,
        sources: zoyaResponse.sources
      };
      setMessages((prev) => [...prev, zoyaMsg]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    }
  }, [isMuted, isSessionActive]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetZoyaSession();
    } else {
      try {
        setIsSessionActive(true);
        resetZoyaSession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
        };
        
        session.onMessage = (sender, text) => {
          setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + sender, sender, text }]);
        };
        
        session.onCommand = (url) => {
          if (url.includes('google.com/maps/dir')) {
            try {
              const urlObj = new URL(url);
              const origin = urlObj.searchParams.get('origin');
              const destination = urlObj.searchParams.get('destination');
              if (destination) {
                setActiveMap({ origin: origin || undefined, destination });
              }
            } catch (e) {
              console.error("Failed to parse directions URL", e);
            }
          } else {
            setTimeout(() => {
              window.open(url, "_blank");
            }, 1000);
          }
        };

        session.onError = (type) => {
          setErrorType(type);
          setShowPermissionModal(true);
        };

        await session.start(userLocation || undefined);
      } catch (e: any) {
        console.error("Failed to start session", e);
        const msg = e?.message || "";
        if (msg === "Permission denied") {
          setErrorType("PERMISSION_DENIED");
        } else if (msg === "Microphone error") {
          setErrorType("MIC_ERROR");
        } else {
          setErrorType("ERROR");
        }
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0">
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
          errorType={errorType}
        />
      )}

      {showVideoGenerator && (
        <VideoGenerator 
          onClose={() => setShowVideoGenerator(false)} 
        />
      )}

      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-violet-900/10 blur-[60px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-pink-900/10 blur-[60px] rounded-full" />
      </div>

      <AnimatePresence>
        {activeMap && (
          <InteractiveMap 
            origin={activeMap.origin} 
            destination={activeMap.destination} 
            onClose={() => setActiveMap(null)} 
          />
        )}
      </AnimatePresence>

      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex items-center justify-center font-bold text-sm">
            Z
          </div>
          <h1 className="text-xl font-serif font-medium tracking-wide opacity-90">Zoya</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <>
              <button
                onClick={handleDownloadChat}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                title="Download Chat Locally"
              >
                <Save size={18} className="opacity-70" />
              </button>
              <button
                onClick={() => {
                  if (confirm("Clear local chat history?")) {
                    setMessages([
                      { id: "1", sender: "zoya", text: "Namaste! I'm Zoya. How can I entertain you today?" }
                    ]);
                    localStorage.removeItem("zoya_chat_local_cache");
                    resetZoyaSession();
                  }
                }}
                className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
                title="Clear History"
              >
                <Trash2 size={18} className="opacity-70" />
              </button>
            </>
          )}

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX size={18} className="opacity-70" />
            ) : (
              <Volume2 size={18} className="opacity-70" />
            )}
          </button>
        </div>
      </header>

      <div className="absolute inset-x-0 top-24 bottom-32 overflow-y-auto px-6 md:px-12 pointer-events-none z-10 custom-scrollbar">
        <div className="max-w-2xl mx-auto flex flex-col gap-4 pointer-events-auto pb-4">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm backdrop-blur-md border ${
                  msg.sender === "user" 
                    ? "bg-violet-500/10 border-violet-500/30 text-violet-100" 
                    : "bg-white/5 border-white/10 text-white/90"
                }`}
              >
                {msg.text}
                
                {msg.sources && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-2">
                    {msg.sources.map((source, idx) => (
                      <a 
                        key={idx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-[10px] px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
                          source.type === "maps" 
                            ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" 
                            : "bg-white/10 text-white/70 hover:bg-white/20"
                        }`}
                      >
                        {source.type === "maps" ? <Map size={8} /> : <Send size={8} />}
                        {source.title || (source.type === "maps" ? "Directions" : "Source")}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <main className="absolute inset-0 flex flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-20 pb-24 px-4 md:px-12 pointer-events-none">
        <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
          <div className="h-6">
            <AnimatePresence>
              {appState === "processing" && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2 text-cyan-300/80 text-sm md:text-base italic font-serif"
                >
                  <Loader2 size={16} className="animate-spin" />
                  Replying...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <Visualizer state={appState} />
        </div>

        <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
          <div className="h-6 flex justify-end">
            <AnimatePresence>
              {appState === "listening" && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 text-violet-300/80 text-sm md:text-base italic"
                >
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                  Listening...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-20 shrink-0 gap-4">
        <AnimatePresence>
          {showTextInput && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-md flex flex-col gap-2 px-4"
            >
              <form 
                onSubmit={handleTextSubmit}
                className="w-full flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1 pl-4 backdrop-blur-md shadow-2xl"
              >
                <input 
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a message to Zoya..."
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={isDictating ? stopDictation : startDictation}
                  className={`p-2 rounded-full transition-colors ${isDictating ? 'bg-red-500 animate-pulse' : 'hover:bg-white/10 text-white/60'}`}
                  title={isDictating ? "Stop Voice Typing" : "Voice Typing"}
                >
                  <Mic size={16} />
                </button>
                <button 
                  type="submit"
                  disabled={!textInput.trim()}
                  className="p-2 rounded-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:hover:bg-violet-500 transition-colors"
                >
                  <Send size={16} />
                </button>
              </form>
              <div className="flex justify-center">
                <button 
                  onClick={() => {
                    setShowVideoGenerator(true);
                    setShowTextInput(false);
                  }}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] uppercase tracking-widest text-violet-300/60 hover:text-violet-300 hover:bg-white/10 transition-all font-mono"
                >
                  <Video size={12} />
                  Zoya Studio
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleListening}
            className={`
              group relative flex items-center gap-3 px-8 py-4 rounded-full font-medium tracking-wide transition-all duration-300 shadow-2xl
              ${
                isSessionActive
                  ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                  : "bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:scale-105"
              }
            `}
          >
            {isSessionActive ? (
              <>
                <MicOff size={20} />
                <span>End Session</span>
              </>
            ) : (
              <>
                <Mic size={20} className="group-hover:animate-bounce" />
                <span>Start Session</span>
              </>
            )}
          </button>
          
          {!isSessionActive && (
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shadow-2xl"
              title="Type instead"
            >
              <Keyboard size={20} className="opacity-70" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
