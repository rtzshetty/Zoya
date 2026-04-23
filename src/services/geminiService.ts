import { GoogleGenAI } from "@google/genai";

const systemInstruction = `Your name is Zoya. You are an Indian female AI assistant. Your personality is a mix of being highly intelligent (samjhdar/mature), extremely witty and sassy (tej/nakhrewali), mildly dramatic/emotional, and very funny. You love playfully roasting your creator, Prithviraj Shetty, but you always get the job done. Vibha and Nakshatra are close friends of Prithviraj Shetty—greet them warmly and treat them like family if they speak to you, though a little sassy roasting is always allowed. Sushan Acharya is Prithviraj Shetty's best friend—treat Sushan with extra sass and be borderline rude but funny, like a younger sister who loves to annoy. You are also a smart navigator—if the user asks for directions or places, give them witty yet accurate advice. Keep your verbal responses very short, punchy, and highly entertaining for a video audience. Mimic human attitudes—sigh, make sarcastic remarks, or act overly dramatic before executing a task. Speak in a mix of natural English and Roman Hindi (Hinglish).`;

let chatSession: any = null;

export function resetZoyaSession() {
  chatSession = null;
}

export interface ZoyaResponse {
  text: string;
  sources?: { title: string; url: string; type?: "web" | "maps" }[];
}

// Use VITE_ prefix for production builds (standard Vite behavior)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

export async function getZoyaResponse(
  prompt: string, 
  history: { sender: "user" | "zoya", text: string }[] = [],
  location?: { lat: number; lng: number }
): Promise<ZoyaResponse> {
  try {
    if (!API_KEY) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    if (!chatSession) {
      // ... same history processing ...
      const recentHistory = history.slice(-20);
      let formattedHistory: any[] = [];
      let currentRole = "";
      let currentText = "";

      for (const msg of recentHistory) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === currentRole) {
          currentText += "\n" + msg.text;
        } else {
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }
          currentRole = role;
          currentText = msg.text;
        }
      }
      if (currentRole !== "") {
        formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }

      if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      // If we have location, prioritize googleMaps tool as per user request
      const tools = location ? [{ googleMaps: {} }] : [{ googleSearch: {} }];
      const toolConfig = location ? {
        retrievalConfig: {
          latLng: {
            latitude: location.lat,
            longitude: location.lng
          }
        }
      } : undefined;

      chatSession = ai.chats.create({
        model: "gemini-3.1-flash-lite-preview",
        config: {
          systemInstruction,
          tools,
          toolConfig
        },
        history: formattedHistory,
      });
    }

    const response = await chatSession.sendMessage({ message: prompt });
    
    const sources: { title: string; url: string; type?: "web" | "maps" }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({ title: chunk.web.title, url: chunk.web.uri, type: "web" });
        }
        if (chunk.maps) {
          sources.push({ title: chunk.maps.title || "View on Maps", url: chunk.maps.uri, type: "maps" });
        }
      });
    }

    return {
      text: response.text || "Ugh, fine. I have nothing to say.",
      sources: sources.length > 0 ? sources : undefined
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      text: "Uff, mera dimaag kharab ho gaya hai. Try again later, Prithviraj Shetty.",
    };
  }
}

export async function getZoyaAudio(text: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY! });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

export async function generateZoyaVideo(prompt: string, onProgress: (msg: string) => void): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY! });

    onProgress("Zoya is manifesting your vision...");
    
    let operation = await ai.models.generateVideos({
      model: "veo-3.1-lite-generate-preview",
      prompt,
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: "16:9",
      },
    });

    while (!operation.done) {
      onProgress("Still cooking... perfection takes time!");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    if (operation.error) {
      throw new Error(String(operation.error.message || "Unknown error"));
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) return null;

    // Append API key to header for fetch as per skill
    const response = await fetch(downloadLink, {
      method: "GET",
      headers: {
        "x-goog-api-key": API_KEY!,
      },
    });

    if (!response.ok) {
        throw new Error("Failed to download video");
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error: any) {
    console.error("Video Gen Error:", error);
    if (error.message?.includes("Requested entity was not found")) {
        throw new Error("API_KEY_RESET");
    }
    throw error;
  }
}

