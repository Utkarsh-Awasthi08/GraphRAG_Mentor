import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.OPEN_ROUTER_API_KEY || process.env.OPENROUTER_API_KEY;

async function checkKey() {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      }
    });
    const data = await res.json();
    console.log("OpenRouter Key Info:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error checking OpenRouter key:", err);
  }
}

checkKey();
