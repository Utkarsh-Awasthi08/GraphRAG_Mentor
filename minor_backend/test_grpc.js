import { generateText } from "./service/aiGateway.js";

async function test() {
  try {
    console.log("Testing gRPC connection...");
    const result = await generateText("Hello, this is a test prompt. Reply with 'Connection successful'.", {
      use_cache: false,
      use_semantic_cache: false,
    });
    console.log("Response:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
