const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Global chat instance (you can extend this to use sessions per user if needed)
const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });
const chat = model.startChat({
  history: [],
  generationConfig: {
    temperature: 0,
      topP: 0.8,     
      topK: 40 ,
  },
});

router.post("/coach", async (req, res) => {
  const { message } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const result = await chat.sendMessage(message);
    const rawReply = result.response.text();

    // Clean markdown: remove **bold**, *italic/bullets*, and fix \n
    const cleanedReply = rawReply
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove **bold**
      .replace(/\*(.*?)\*/g, "$1")     // Remove *italic* or bullet-style
      .replace(/\\n/g, "\n")           // Replace escaped newlines
      .trim();

    res.json({ reply: cleanedReply });
  } catch (error) {
    console.error("AI coach error:", error);
    res.status(500).json({ error: "AI career coach failed." });
  }
});

module.exports = router;
