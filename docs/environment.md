# Environment

The root `.env.example` documents the complete local environment. App-specific examples live in `frontend/.env.example` and `backend/.env.example`.

## Variables

- `VITE_API_BASE_URL`: Browser-facing backend origin used by the frontend.
- `PORT`: Backend HTTP port.
- `CORS_ORIGIN`: Allowed frontend origin for local development.
- `DATABASE_URL`: PostgreSQL connection string reserved for the future data layer.
- `GROQ_API_KEY`: Required for the Interviewer Decision Engine and feedback report generation. Without it, interview turns fail with a clear 503 rather than silently degrading. Groq has a free tier — get a key at https://console.groq.com/keys.
- `DECISION_ENGINE_MODEL`: Groq model used for interviewer decisions and feedback generation. Defaults to `openai/gpt-oss-120b`.
- `DECISION_ENGINE_REASONING_EFFORT`: Reasoning depth passed to the model (`low` | `medium` | `high`). Defaults to `high`.
- `STT_MODEL`: Groq Whisper model used to transcribe candidate speech. Defaults to `whisper-large-v3-turbo`.
- `TTS_MODEL`: Groq Orpheus model used to voice the interviewer. Defaults to `canopylabs/orpheus-v1-english`. This model requires one-time org terms acceptance — visit https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english and accept before TTS will work (a 400 `model_terms_required` error means this hasn't been done yet).
- `TTS_VOICE`: Orpheus voice name. Defaults to `troy` (other known voices: `hannah`, `austin`).

Do not commit real `.env` files.
