// Base URL for the Solar System Sizing backend (FastAPI on Render).
// The existing /analyze-adapter call in Step1Load already targets this host.
const BACKEND_URL = 'https://solar-calculator001-8.onrender.com';

/**
 * Parse free text (typed list, transcript, or PDF text) into structured
 * appliances via the backend's Groq LLM endpoint. Each returned appliance is
 * matched to the known catalog where possible so category + surge multiplier
 * are filled in.
 *
 * @param {string} text - free text describing appliances
 * @returns {Promise<Array>} parsed appliances
 */
export async function parseAppliances(text) {
  const res = await fetch(`${BACKEND_URL}/parse-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch { /* ignore parse error */ }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  const data = await res.json();
  return data.appliances || [];
}

/**
 * Transcribe an audio recording (from MediaRecorder) to text via the backend's
 * Groq Whisper endpoint.
 *
 * @param {Blob} audio - recorded audio blob
 * @returns {Promise<string>} transcribed text
 */
export async function transcribeAudio(audio) {
  const form = new FormData();
  const ext = audio.type.includes('webm') ? 'webm' : audio.type.includes('mp4') ? 'mp4' : 'wav';
  form.append('file', audio, `recording.${ext}`);

  const res = await fetch(`${BACKEND_URL}/transcribe`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch { /* ignore parse error */ }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  const data = await res.json();
  return data.text || '';
}
