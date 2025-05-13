// controllers/resumeController.js

const fs                   = require("fs");
const pdf                  = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { saveResume }       = require("../models/Resume");

exports.uploadResume = async (req, res) => {
  try {
    // Safely pull name/email (defaults if missing)
    const { name = "Anonymous", email = null } = req.body || {};

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No resume file uploaded." });
    }

    // 1) Read & parse the PDF
    const pdfBuffer = fs.readFileSync(req.file.path);
    const data      = await pdf(pdfBuffer);
    let resumeText  = data.text || "";
    // strip null bytes so PG won't choke
    resumeText      = resumeText.replace(/\u0000/g, "");

    // 2) Build the AI prompt
    const prompt = `You are an HR expert. Analyze this resume and give suggestions about how the user can improve their:
- Summary
- Skills
- Suggestions for improvement
Also suggest a CV score for this

--- RESUME START ---
${resumeText}
--- RESUME END ---`;

    // 3) Generate with Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel
    
    ({ model: "models/gemini-2.0-flash",temperature: 0,
      topP: 0.8,     
      topK: 40  
    });
    
    const result = await model.generateContent(prompt);
    const raw    = await result.response.text();

    // 4) Strip nulls from raw AI text just in case
    const safeRaw = raw.replace(/\u0000/g, "");

    // 5) Format headings + strip stray asterisks
    const formattedLines = safeRaw.split("\n").map((line) => {
      const m = line.match(/^\*{2}(.+?)\*{2}:\s*(.*)$/);
      if (m) {
        const heading = m[1].trim();
        const rest    = m[2].trim();
        return rest
          ? `<strong>${heading}:</strong> ${rest}`
          : `<strong>${heading}:</strong>`;
      }
      return line.replace(/\*/g, "").trim();
    });
    let analysis = formattedLines.join("\n\n");
    // strip any nulls again
    analysis = analysis.replace(/\u0000/g, "");

    // 6) Try saving to the DB
    let saved;
    try {
      saved = await saveResume({
        name,
        email,
        filename: req.file.originalname,
        text: resumeText,
        analysis,
      });
    } catch (dbErr) {
      console.error("⚠️ DB save failed:", dbErr);
      // If it was an encoding error, or any other dbErr,
      // we STILL want to return the analysis back to the client.
      return res.json({
        success: true,
        warning:
          "We couldn’t save your resume due to an encoding issue, but here’s your analysis.",
        data: { name, email, filename: req.file.originalname, text: resumeText, analysis },
      });
    }

    // 7) Normal success
    res.json({ success: true, data: saved });
  } catch (err) {
    console.error("❌ uploadResume error:", err);
    res.status(500).json({ success: false, error: "Failed to process resume" });
  }
};
