import { GoogleGenAI, Modality } from "@google/genai";
import fs from "fs";

async function run() {
  const apiKey = process.env.VITE_GEMINI_API_KEY || "YOUR_KEY_HERE";
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const session = await ai.live.connect({
      model: "models/gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO]
      },
      callbacks: {
        onmessage: () => {}
      }
    });
    console.log("Connected successfully with basic config");
    session.close();
  } catch (e) {
    console.error("Basic error:", e);
  }
}

run();
