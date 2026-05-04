import { GoogleGenAI, Modality, Type } from "@google/genai";

async function run() {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const session = await ai.live.connect({
      model: "models/gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      },
      callbacks: {
        onmessage: () => {}
      }
    });

    session.sendClientContent({
      // @ts-ignore
      turns: "Hello there!"
    });
    console.log("Called sendClientContent with transcription!");
    
    // wait for a bit
    await new Promise(r => setTimeout(r, 2000));
    session.close();
  } catch (e: any) {
    console.error("Transcription error:", e.message);
  }
}

run();
