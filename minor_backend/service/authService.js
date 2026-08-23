import driver from "../neo4.js";
import bcrypt from "bcryptjs";

export async function createUser(username, password) {
  const session = driver.session();
  try {
    // Check if user exists
    const checkQuery = `MATCH (u:User {id: $username}) RETURN u`;
    const checkResult = await session.run(checkQuery, { username });
    
    if (checkResult.records.length > 0) {
      throw new Error("User already exists");
    }

    // Hash the password securely
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create User in Neo4j
    const createQuery = `
      CREATE (u:User {id: $username, passwordHash: $passwordHash})
      RETURN u
    `;
    await session.run(createQuery, { username, passwordHash });
    
    return { username };
  } finally {
    await session.close();
  }
}

export async function verifyUser(username, password) {
  const session = driver.session();
  try {
    const query = `MATCH (u:User {id: $username}) RETURN u.passwordHash AS hash`;
    const result = await session.run(query, { username });
    
    if (result.records.length === 0) {
      throw new Error("Invalid username or password");
    }
    
    const hash = result.records[0].get("hash");
    if (!hash) {
      throw new Error("Invalid username or password");
    }
    
    const isValid = await bcrypt.compare(password, hash);
    if (!isValid) {
      throw new Error("Invalid username or password");
    }
    
    return { username };
  } finally {
    await session.close();
  }
}
