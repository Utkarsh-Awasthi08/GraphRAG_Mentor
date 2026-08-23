import express from "express";
import jwt from "jsonwebtoken";
import { createUser, verifyUser, resetPassword } from "../service/authService.js";

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

router.post("/reset-password", async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ error: "Username and new password are required" });
    }
    
    await resetPassword(username, newPassword);
    
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
