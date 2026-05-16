import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not found in .env");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // We use the raw fetch because the SDK's listModels might be limited
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    console.log("--- AVAILABLE MODELS ---");
    if (data.models) {
      data.models.forEach((model: any) => {
        console.log(`${model.name} (Methods: ${model.supportedGenerationMethods.join(", ")})`);
      });
    } else {
      console.log("No models found or error in response:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("Failed to list models:", error);
  }
}

listModels();
