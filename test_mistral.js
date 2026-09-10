import { Mistral } from "@mistralai/mistralai";
import dotenv from "dotenv";
dotenv.config();

console.log("Key length:", process.env.MISTRAL_API_KEY ? process.env.MISTRAL_API_KEY.length : 0);
console.log("Key starts with:", process.env.MISTRAL_API_KEY ? process.env.MISTRAL_API_KEY.substring(0, 4) : "N/A");

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
mistral.embeddings.create({
  model: "codestral-embed",
  inputs: ["test"],
}).then(res => console.log("Embed success:", res.data[0].embedding.length))
  .catch(err => console.log("Embed error:", err.message));
