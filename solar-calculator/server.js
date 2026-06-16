import express from 'express';
import ImageKit from 'imagekit';
import cors from 'cors';
import multer from 'multer';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

// Load environment variables (optional for later)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Multer setup (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: "public_vsId3htZEC6gSbS4wvd/wKPECX0=",
  privateKey: "private_YDJs8PxLV0xBI10zYUt+M5RKdg0=",
  urlEndpoint: "https://ik.imagekit.io/k6xytynbn"
});

// Initialize Groq
const groq = new Groq({
  apiKey: "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"
});

// Health route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// ✅ SINGLE CLEAN IMAGE ANALYSIS ROUTE
app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
  try {
    console.log("📸 Request received");

    if (!req.file) {
      console.log("❌ No file uploaded");
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log("📦 File received:", req.file.mimetype);

    // ✅ Upload image to ImageKit
    const uploadResponse = await imagekit.upload({
      file: req.file.buffer.toString('base64'),
      fileName: `upload_${Date.now()}.jpg`,
      folder: "/ai-uploads"
    });

    const imageUrl = uploadResponse.url;
    console.log("🌐 Image URL:", imageUrl);

    // ✅ Send image to Groq Vision model
    const completion = await groq.chat.completions.create({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            },
            {
              type: 'text',
              text: `You are analyzing an appliance label.

Extract the wattage.

Return ONLY JSON:
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
    console.log("🤖 RAW AI RESPONSE:", responseText);

    // ✅ Parse JSON safely
    let result;
    try {
      const match = responseText.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : null;

      if (!result) throw new Error("Invalid JSON format");
    } catch (err) {
      console.log("⚠️ JSON parse failed");
      result = {
        wattage: null,
        confidence: null,
        raw_text: responseText,
        calculation: 'Failed to parse AI response'
      };
    }

    res.json(result);

  } catch (error) {
    console.error("🔥 ERROR:", error);

    res.status(500).json({
      error: 'Failed to analyze image',
      message: error.message
    });
  }
});

// Start server (ONLY ONCE)
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
});
