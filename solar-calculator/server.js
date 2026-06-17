import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY // 🔥 replace this
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ✅ TEST ROUTE (NO IMAGE UPLOAD)
app.get('/api/test-image', async (req, res) => {
  try {
    console.log("🧪 Testing Groq with static image...");

    const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronius_Symo_20.0-3-M.jpg";

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
              text: `Extract the wattage from this appliance label.

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
        calculation: "Parsing failed"
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
});
