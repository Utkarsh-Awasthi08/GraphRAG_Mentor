import neo4j from "neo4j-driver";
import dotenv from "dotenv";
dotenv.config();
const driver = neo4j.driver(
  "bolt://localhost:7687",
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
  {
    encrypted: "ENCRYPTION_OFF"
  }
);

export default driver;