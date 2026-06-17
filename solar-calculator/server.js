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

    const imageDataUrl = "data:image/png;base64,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";

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
