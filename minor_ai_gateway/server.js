import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import path from "path";
import { generateText, streamText } from "./src/aiGateway.js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.join(__dirname, "proto", "aigateway.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const aigatewayProto = grpc.loadPackageDefinition(packageDefinition).aigateway;

// Implement GenerateText
async function GenerateText(call, callback) {
  try {
    const req = call.request;
    const options = {
      preferProvider: req.prefer_provider || undefined,
      cache: req.use_cache !== false, // default true
      semanticCache: req.use_semantic_cache !== false, // default true
      userQuery: req.user_query || undefined,
      cacheTTL: req.cache_ttl || 600,
    };

    const result = await generateText(req.prompt, options);

    callback(null, {
      text: result.text,
      provider_used: result.provider,
      from_cache: result.cached,
    });
  } catch (error) {
    console.error("GenerateText Error:", error);
    callback({
      code: grpc.status.INTERNAL,
      details: error.message,
    });
  }
}

// Implement StreamText
async function StreamText(call) {
  try {
    const req = call.request;
    const options = {
      preferProvider: req.prefer_provider || undefined,
    };

    const result = await streamText(req.prompt, options);

    // Send the first chunk with provider_used if we can, or just send chunks
    for await (const chunkText of result.stream) {
      call.write({
        text: chunkText,
        provider_used: result.provider,
      });
    }

    call.end();
  } catch (error) {
    console.error("StreamText Error:", error);
    call.emit("error", {
      code: grpc.status.INTERNAL,
      details: error.message,
    });
  }
}

// Start Server
function main() {
  const server = new grpc.Server();
  
  server.addService(aigatewayProto.AIGateway.service, {
    GenerateText,
    StreamText,
  });

  const port = process.env.PORT || 50051;
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error("Failed to bind server:", error);
        return;
      }
      console.log(`🤖 AI Gateway gRPC Server running at grpc://0.0.0.0:${port}`);
    }
  );
}

main();
