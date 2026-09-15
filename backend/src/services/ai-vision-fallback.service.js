import dotenv from 'dotenv';
dotenv.config();

/**
 * Cloud AI Vision API Fallback Provider
 * Supports Google Gemini (gemini-2.0-flash, gemini-1.5-flash) and OpenAI-compatible Vision APIs
 */

let runtimeAiConfig = {
  enabled: process.env.ENABLE_CLOUD_AI_FALLBACK === 'true' || true,
  provider: process.env.AI_PROVIDER || 'gemini', // 'gemini' | 'openai'
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  confidenceThreshold: 0.75 // Fallback triggers when local confidence is below this
};

export const getAiVisionConfig = () => {
  return {
    enabled: runtimeAiConfig.enabled,
    provider: runtimeAiConfig.provider,
    geminiModel: runtimeAiConfig.geminiModel,
    openaiModel: runtimeAiConfig.openaiModel,
    hasGeminiKey: !!runtimeAiConfig.geminiApiKey,
    hasOpenaiKey: !!runtimeAiConfig.openaiApiKey,
    confidenceThreshold: runtimeAiConfig.confidenceThreshold
  };
};

export const updateAiVisionConfig = (newConfig) => {
  if (typeof newConfig.enabled === 'boolean') runtimeAiConfig.enabled = newConfig.enabled;
  if (newConfig.provider) runtimeAiConfig.provider = newConfig.provider;
  if (newConfig.geminiApiKey !== undefined) runtimeAiConfig.geminiApiKey = newConfig.geminiApiKey;
  if (newConfig.geminiModel) runtimeAiConfig.geminiModel = newConfig.geminiModel;
  if (newConfig.openaiApiKey !== undefined) runtimeAiConfig.openaiApiKey = newConfig.openaiApiKey;
  if (newConfig.openaiModel) runtimeAiConfig.openaiModel = newConfig.openaiModel;
  if (newConfig.confidenceThreshold) runtimeAiConfig.confidenceThreshold = Number(newConfig.confidenceThreshold);
  return getAiVisionConfig();
};

/**
 * Analyzes meter image using Google Gemini Vision REST API
 */
async function callGeminiVision(imageBuffer, mimeType = 'image/jpeg', readingType = 'electricity') {
  const apiKey = runtimeAiConfig.geminiApiKey;
  if (!apiKey) {
    return null;
  }

  const model = runtimeAiConfig.geminiModel || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const base64Image = imageBuffer.toString('base64');

  const systemInstruction = `You are a precision computer vision system specializing in utility meters (electricity & water).
CRITICAL DOMAIN RULES:
1. For electricity meters (mechanical wheel counters):
   - The red box on the right represents the fractional tenth of a kWh (0.1 kWh).
   - EXCLUDE the red digit from the calculated billing integer value!
   - Only the black/white digits to the left are whole kWh.
   - Example: Dial shows "9 9 9 8 5" in white boxes and "3" in red box -> white_digits="99985", red_digit="3", value=99985, full_display="99985.3".
   - Brand new or reset meter showing "0 0 0 0 0" white and "0" red -> white_digits="00000", red_digit="0", value=0, full_display="00000.0".
2. For water meters: return all integer m³ digits.
3. Assess environment: lighting (dark/glare/standard), glass reflection, cabinet type, wiring.

You MUST reply ONLY with valid JSON in this exact structure without markdown formatting:
{
  "value": 0,
  "white_digits": "00000",
  "red_digit": "0",
  "full_display": "00000.0",
  "total_digits": 6,
  "meter_model": "EMIC CV140",
  "serial_number": "19658335",
  "confidence": 0.98,
  "rule_applied": "Chỉ lấy các số trong ô trắng, loại trừ số trong ô đỏ ở cuối.",
  "environment": {
    "lighting": { "status": "Chuẩn", "ambient_score": 140, "flash_recommended": false },
    "reflection_and_glare": { "has_glare": false, "glare_status": "Không lóa" },
    "installation_context": { "cabinet_type": "Hộp bảo vệ", "wiring_environment": "1 pha" }
  }
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: systemInstruction },
          {
            text: `Analyze this ${readingType} meter image. Read the dial numbers accurately following all rules.`
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: 'application/json'
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[Gemini Vision Error]: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) return null;

    const cleaned = candidate.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      ...parsed,
      model_name: `Cloud-Gemini-${model}`
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[Gemini Vision Call Exception]:', err.message);
    return null;
  }
}

/**
 * Analyzes meter image using OpenAI-compatible Vision API
 */
async function callOpenAiVision(imageBuffer, mimeType = 'image/jpeg', readingType = 'electricity') {
  const apiKey = runtimeAiConfig.openaiApiKey;
  if (!apiKey) return null;

  const model = runtimeAiConfig.openaiModel || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';
  const base64Image = imageBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64Image}`;

  const prompt = `You are a utility meter reader. Analyze this ${readingType} meter.
Rule: On electricity meters, EXCLUDE the rightmost red decimal tenth box (0.1 kWh). Only output integer kWh from the white/black boxes as "value".
Reply strictly in JSON:
{
  "value": <number>,
  "white_digits": "<string>",
  "red_digit": "<string>",
  "full_display": "<string>",
  "meter_model": "<string>",
  "serial_number": "<string>",
  "confidence": <number between 0 and 1>
}`;

  const payload = {
    model: model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUri } }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 500
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return null;

    const parsed = JSON.parse(text);
    return {
      ...parsed,
      model_name: `Cloud-OpenAI-${model}`
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Public Fallback Method
 * Invokes configured Cloud AI Vision Provider if local engine has low confidence
 */
export const invokeCloudVisionFallback = async (imageBuffer, mimeType = 'image/jpeg', readingType = 'electricity') => {
  if (!runtimeAiConfig.enabled) {
    return null;
  }

  if (runtimeAiConfig.provider === 'gemini' && runtimeAiConfig.geminiApiKey) {
    const geminiResult = await callGeminiVision(imageBuffer, mimeType, readingType);
    if (geminiResult) return geminiResult;
  }

  if (runtimeAiConfig.openaiApiKey) {
    const openaiResult = await callOpenAiVision(imageBuffer, mimeType, readingType);
    if (openaiResult) return openaiResult;
  }

  return null;
};

export default {
  getAiVisionConfig,
  updateAiVisionConfig,
  invokeCloudVisionFallback
};
