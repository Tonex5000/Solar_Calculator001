import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Multer setup for image uploads
const storage = multer.memoryStorage(); // Store in memory (good for base64 conversion)
const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max (Groq limit)
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ======================
// POST ROUTE - Upload Image (Recommended for Postman)
// ======================
app.post('/api/test-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No image uploaded",
        message: "Please upload an image using form-data with key 'image'"
      });
    }

    console.log("🧪 Processing uploaded image...");

    // Convert buffer to base64 data URL
    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/png';
    const imageDataUrl = `data:${mimeType};base64,${base64}`;

    const completion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageDataUrl }
            },
            {
              type: 'text',
              text: `Extract the wattage from this appliance label.
Return ONLY valid JSON (no extra text):
{
  "wattage": number | null,
  "confidence": "high" | "medium" | "low" | null,
  "raw_text": string,
  "calculation": string
}`
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const responseText = completion.choices[0]?.message?.content || '';
    console.log("🤖 RAW RESPONSE:", responseText);

    let result;
    try {
      const match = responseText.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : null;
      
      if (!result) throw new Error("Invalid JSON");
    } catch (err) {
      result = {
        wattage: null,
        confidence: null,
        raw_text: responseText,
        calculation: "JSON parsing failed"
      };
    }

    res.json(result);
  } catch (error) {
    console.error("🔥 ERROR:", error);
    res.status(500).json({
      error: "Groq test failed",
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📤 Test with Postman → POST http://localhost:${PORT}/api/test-image`);
});
