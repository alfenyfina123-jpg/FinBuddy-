import { GoogleGenAI } from "@google/genai";

export async function getGeminiResponse(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please configure GEMINI_API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });
  
  return response.text || "";
}
