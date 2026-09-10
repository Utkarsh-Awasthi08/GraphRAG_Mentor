import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_PATH = path.join(__dirname, "..", "proto", "aigateway.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const aigatewayProto = grpc.loadPackageDefinition(packageDefinition).aigateway;

// Determine AI Gateway host based on environment
const GATEWAY_URL = process.env.AI_GATEWAY_URL || "localhost:50051";

const client = new aigatewayProto.AIGateway(
  GATEWAY_URL,
  grpc.credentials.createInsecure()
);

/**
 * Generate text via gRPC AI Gateway
 * @param {string} prompt 
 * @param {object} options 
 * @returns {Promise<{text: string, provider: string, cached: boolean}>}
 */
export function generateText(prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      prompt,
      prefer_provider: options.preferProvider || "",
      use_cache: options.cache !== false,
      use_semantic_cache: options.semanticCache !== false,
      user_query: options.userQuery || "",
      cache_ttl: options.cacheTTL || 600,
    };

    client.GenerateText(req, (error, response) => {
      if (error) {
        return reject(error);
      }
      resolve({
        text: response.text,
        provider: response.provider_used,
        cached: response.from_cache,
      });
    });
  });
}

/**
 * Stream text via gRPC AI Gateway
 * @param {string} prompt 
 * @param {object} options 
 * @returns {Promise<{stream: AsyncGenerator<string>, provider: string}>}
 */
export async function streamText(prompt, options = {}) {
  const req = {
    prompt,
    prefer_provider: options.preferProvider || "",
  };

  const call = client.StreamText(req);

  // We wrap the gRPC stream into an async generator for compatibility 
  // with the existing Express SSE code.
  async function* createAsyncGenerator() {
    for await (const chunk of call) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }

  // To get the provider, we ideally read it from the first chunk or metadata
  // For simplicity, we just return the generator and a generic provider string.
  return {
    stream: createAsyncGenerator(),
    provider: "gRPC-Gateway",
  };
}

/**
 * Call Mistral via gRPC AI Gateway — for structured tasks (Cypher, classification).
 * @param {string} prompt
 * @param {object} options
 * @param {'large'|'fast'} options.tier - 'large' for mistral-large, 'fast' for ministral-8b
 * @param {boolean} options.cache
 * @param {number} options.cacheTTL
 * @returns {Promise<{text: string, provider: string, cached: boolean}>}
 */
export function generateMistral(prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      prompt,
      tier:      options.tier || "large",
      use_cache: options.cache !== false,
      cache_ttl: options.cacheTTL || 300,
    };

    client.GenerateMistral(req, (error, response) => {
      if (error) return reject(error);
      resolve({
        text:     response.text,
        provider: response.provider_used,
        cached:   response.from_cache,
      });
    });
  });
}

/**
 * Stub for gateway status.
 * In a full production setup, this would be an RPC call to the gateway.
 */
export function getGatewayStatus() {
  return [{
    provider: "gRPC Gateway",
    enabled: true,
    status: "Healthy"
  }];
}
