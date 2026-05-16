const fs = require("fs");
const path = require("path");

// Manually parse .env
const envPath = path.join(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf8");
const apiKeyMatch = envContent.match(/GEMINI_API_KEY=(.*)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : null;

async function listModels() {
  if (!apiKey) {
    console.error("GEMINI_API_KEY not found in .env");
    return;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    console.log("--- AVAILABLE MODELS ---");
    if (data.models) {
      data.models.forEach((model) => {
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
