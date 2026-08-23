import express from "express";
import jwt from "jsonwebtoken";
import { createUser, verifyUser } from "../service/authService.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_key";

router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    
    await createUser(username, password);
    
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, username });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    
    await verifyUser(username, password);
    
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, username });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

export default router;
