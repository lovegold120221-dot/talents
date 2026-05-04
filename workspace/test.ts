import { GoogleGenAI, Modality } from "@google/genai";
import fetch from "node-fetch";

// We'll use globalThis to assign our API key for typescript node testing
const apiKey = process.env.VITE_GEMINI_API_KEY || (process.env.GEMINI_API_KEY);

async function run() {
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
