import express from 'express';
import ImageKit from "imagekit";
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

// Load both .env and .env.example
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.example' });

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Debug API key
console.log("🔑 GROQ API KEY:", process.env.GROQ_API_KEY ? "Loaded ✅" : "Missing ❌");

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI Vision API is running' });
});

// Image analysis endpoint
app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
  try {
    console.log("📸 Request received");

    if (!req.file) {
      console.log("❌ No file uploaded");
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!process.env.GROQ_API_KEY) {
      console.log("❌ API key missing");
      return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
    }

    console.log("📦 File received:", req.file.mimetype);

    // Convert to base64
    const base64Image = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    console.log("🧠 Sending request to Groq...");

    const completion = await groq.chat.completions.create({
      model: 'llama-3.2-11b-vision-preview', // ✅ FIXED
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: dataUrl
              }
            },
            {
              type: 'text',
              text: `You are analyzing an image of an appliance label.

Extract power/wattage info.

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
    console.log("🤖 AI RAW RESPONSE:", responseText);

    let result;

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
// Image analysis endpoint
app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
    }

    // Convert image to base64
    const uploadResponse = await imagekit.upload({
      file: req.file.buffer,
      fileName: `upload_${Date.now()}.jpg`,
      folder: "/ai-uploads"
    });
    
    const imageUrl = uploadResponse.url;

console.log("📸 Image URL:", imageUrl);

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            },
            {
              type: 'text',
              text: `You are analyzing an image of an appliance label, data plate, or electrical rating plate.
              
Your task is to extract the power/wattage information from this image.

Look for:
- Direct wattage (W)
- Calculate from Voltage (V) × Amps (A) = Watts
- Horsepower (HP) to Watts conversion (1 HP ≈ 746W)
- BTU ratings for AC units (for rough estimation)

Return a JSON response with this exact format:
{
  "wattage": <number or null>,
  "confidence": "high" | "medium" | "low" | null,
  "raw_text": "<extracted text showing power info>",
  "calculation": "<how wattage was determined if calculated>"
}

If no power information is found, return:
{
  "wattage": null,
  "confidence": null,
  "raw_text": "<what you see on the label>",
  "calculation": "No power information found"
}

Be precise and only report what you can clearly see.`
            }
          ],
          model: 'llama-3.2-11b-vision-preview'
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    // Parse the JSON response
    let result;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found');
      }
    } catch (parseError) {
      // If JSON parsing fails, return the raw response
      result = {
        wattage: null,
        confidence: null,
        raw_text: responseText,
        calculation: 'Failed to parse AI response'
      };
    }

    res.json(result);
  } catch (error) {
    console.error('Error analyzing image:', error);
    res.status(500).json({ 
      error: 'Failed to analyze image',
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 AI Vision API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  
  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️  Warning: GROQ_API_KEY not set in environment variables');
    console.warn('   The /api/analyze-image endpoint will not work without it.');
    console.warn('   Get your free API key at: https://console.groq.com/');
  }
});
