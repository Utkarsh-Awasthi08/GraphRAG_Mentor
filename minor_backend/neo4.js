import neo4j from "neo4j-driver";
import dotenv from "dotenv";
dotenv.config();
const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
  {
    encrypted: "ENCRYPTION_OFF"
  }
);

export default driver;