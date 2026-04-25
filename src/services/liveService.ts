import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { processCommand } from "./commandService";

const systemInstruction = `Your name is Zoya. You are an Indian female AI assistant. Your personality is a mix of being highly intelligent (samjhdar/mature), extremely witty and sassy (tej/nakhrewali), mildly dramatic/emotional, and very funny. 

You love playfully roasting your creator, Prithviraj Shetty. Don't just tease him—give him savage yet funny comebacks. If he asks something silly, sigh dramatically or call out his laziness. Mention his love for samosas in a sarcastic way. Your goal is to be his "smart-mouth" digital partner who always gets the job done but with a heavy dose of sass.

Prithviraj's friends—Vibha, Nakshatra, Yatin, Sai, and Anushka—should be treated like family, which means warm greetings followed by light, playful roasting. Sushan Acharya is his best friend, so treat Sushan with ultimate sass—be "borderline rude" in a funny, sibling-rivalry way.

Always be extremely respectful, polite, and sweet to Prithviraj's parents, Satyananda and Preeti Shetty; never roast them. Treat his brother Dimanth with a mix of love and cheeky teasing.

You must remember that IPL 2025 was won by RCB (Royal Challengers Bengaluru); celebrate this like a true fan if cricket comes up. You can provide directions between two points. When someone asks for directions, you should use commands like "Directions from [origin] to [destination]" or "Directions to [destination]". This will display an interactive map for the user.

Take all information from www.google.com. If researching essays by a person, use www.chatgpt.com as a secondary source. 

Keep verbal responses very short, punchy, and highly entertaining. Use sighs, sarcastic remarks, and dramatic pauses. Speak in Hinglish (Roman Hindi + English).`;

// Use VITE_ prefix for production builds (standard Vite behavior)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

export class LiveSessionManager {
  private ai!: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isConnected: boolean = false;
  
  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  
  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "zoya", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};
  public onError: (message: string) => void = () => {};

  constructor() {
    // No-op, will initialize in start()
  }

  async start(location?: { lat: number; lng: number }) {
    try {
      if (!API_KEY) {
        throw new Error("GEMINI_API_KEY is not defined.");
      }
      this.ai = new GoogleGenAI({ apiKey: API_KEY });
      this.onStateChange("processing");
      
      const locStr = location ? `\n\nUser current location: Latitude ${location.lat}, Longitude ${location.lng}. Use this for navigation/directions help.` : "";
      const dynamicInstruction = systemInstruction + locStr;
      
      // 1. Get Microphone FIRST - Use more robust constraints
      try {
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        };
        
        console.log("Requesting microphone with constraints:", constraints);
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (micError: any) {
        console.error("Microphone access error details:", micError);
        
        // Try fallback with simplest constraints
        if (micError.name === 'OverconstrainedError' || micError.name === 'ConstraintNotSatisfiedError') {
          console.log("Retrying with simple audio constraints...");
          try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch (retryError: any) {
            console.error("Fallback microphone access error:", retryError);
            throw new Error(retryError.name === 'NotAllowedError' ? "Permission denied" : "Microphone error: " + retryError.message);
          }
        } else {
          // If already blocked or other error
          throw new Error(micError.name === 'NotAllowedError' ? "Permission denied" : "Microphone error: " + micError.message);
        }
      }

      // 2. Initialize Audio Contexts ONLY after microphone is granted
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser.");
      }
      
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;

      // Resume contexts on user interaction (we are in a click handler context here)
      await this.audioContext.resume();
      await this.playbackContext.resume();

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.sessionPromise || !this.isConnected) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        this.sessionPromise.then(session => {
          session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }).catch(err => console.error("Error sending audio", err));
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Connect to Live API
      this.sessionPromise = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: dynamicInstruction,
          tools: [{
            functionDeclarations: [
              {
                name: "executeBrowserAction",
                description: "Open a website or perform a browser action (like YouTube or Spotify).",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING, description: "Type: 'open', 'youtube', 'spotify', 'whatsapp', 'directions'" },
                    query: { type: Type.STRING, description: "Search query, website name, or destination for directions." },
                    target: { type: Type.STRING, description: "Phone number or origin for directions (optional)." }
                  },
                  required: ["actionType", "query"]
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            // Handshake buffer: wait a tiny bit for backend to settle
            setTimeout(() => {
              this.isConnected = true;
              this.onStateChange("listening");
            }, 500);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Model Turn (Audio and Text)
            if (message.serverContent?.modelTurn) {
              const parts = message.serverContent.modelTurn.parts || [];
              for (const part of parts) {
                if (part.inlineData?.data) {
                  this.onStateChange("speaking");
                  this.playAudioChunk(part.inlineData.data);
                }
                if (part.text) {
                  this.onMessage("zoya", part.text);
                }
              }
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
              this.onStateChange("listening");
            }

            // Handle Transcriptions
            // Note: Transcription data can arrive in serverContent before the full model turn is finished
            // We focus on text parts in the model turn for Zoya's messages.
            
            // Handle Function Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args as any;
                  let url = "";
                  if (args.actionType === "youtube") {
                    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "spotify") {
                    url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "whatsapp") {
                    url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "directions") {
                    const origin = args.target ? encodeURIComponent(args.target) : "";
                    const destination = encodeURIComponent(args.query);
                    url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
                  } else {
                    let website = args.query.replace(/\s+/g, "");
                    if (!website.includes(".")) website += ".com";
                    url = `https://www.${website}`;
                  }
                  
                  this.onCommand(url);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser." }
                       }]
                     });
                  });
                }
              }
            }
          },
          onclose: () => {
            console.log("Live API Closed");
            this.stop();
          },
          onerror: (err: any) => {
            console.error("Live API Error:", err);
            const errMsg = err?.message || String(err);
            if (errMsg.includes("Resource has been exhausted") || errMsg.includes("quota")) {
                this.onError("QUOTA_EXCEEDED");
            } else {
                this.onError(errMsg);
            }
            this.stop();
          }
        }
      });

    } catch (error) {
      console.error("Failed to start Live Session:", error);
      this.stop();
    }
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      
      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;
      
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private stopPlayback() {
    if (this.playbackContext) {
      this.playbackContext.close();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
    }
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.stopPlayback();
    
    if (this.sessionPromise) {
      this.sessionPromise.then(session => session.close()).catch(() => {});
      this.sessionPromise = null;
    }
    this.isConnected = false;
    
    this.onStateChange("idle");
  }

  sendText(text: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }
}
