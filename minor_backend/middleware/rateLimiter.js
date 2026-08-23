import rateLimit from "express-rate-limit";

// Limit requests to Gemini API endpoints based on authenticated username
export const geminiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each user to 15 requests per windowMs
  keyGenerator: (req) => {
    // Routes are protected by `authenticate`, so `req.user` is guaranteed
    return req.user?.username || "anonymous";
  },
  validate: { keyGeneratorIpFallback: false },
  message: {
    error: "Too many requests to the AI Mentor. Please wait a few minutes before asking more questions."
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Limit login/registration attempts per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: "Too many login/registration attempts. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit for other routes like history/submissions
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each user to 100 requests per windowMs
  keyGenerator: (req) => {
    return req.user?.username || "anonymous";
  },
  validate: { keyGeneratorIpFallback: false },
  message: {
    error: "Too many requests, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
});
