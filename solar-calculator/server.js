import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS middleware - allow all origins for development
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ''
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI Vision API is running' });
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
    const base64Image = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    const completion = await groq.chat.completions.create({
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