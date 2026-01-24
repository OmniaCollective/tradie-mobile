
import { GoogleGenAI, Type } from "@google/genai";

export interface AISuggestedQuote {
  hours: number;
  materials: number;
  complexity: string;
  justification: string;
}

export async function getSuggestedQuote(jobDescription: string, jobType: string): Promise<AISuggestedQuote> {
  // Fix: Initialize GoogleGenAI inside the function using process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest a plumbing quote for: ${jobType}. Description: ${jobDescription}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hours: { type: Type.NUMBER, description: "Estimated labour hours" },
            materials: { type: Type.NUMBER, description: "Estimated material costs in GBP" },
            complexity: { type: Type.STRING, description: "Low, Medium, or High" },
            justification: { type: Type.STRING, description: "Short explanation for the estimate" }
          },
          required: ["hours", "materials", "complexity", "justification"]
        }
      }
    });

    // Fix: Access response.text as a property (not a method) and trim it for JSON parsing
    const jsonStr = response.text?.trim() || "{}";
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini failed, using fallback:", error);
    return {
      hours: 1.5,
      materials: 25,
      complexity: "Medium",
      justification: "Standard repair based on general plumbing averages."
    };
  }
}
