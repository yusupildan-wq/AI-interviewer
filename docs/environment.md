# Environment

The root `.env.example` documents the complete local environment. App-specific examples live in `frontend/.env.example` and `backend/.env.example`.

## Variables

- `VITE_API_BASE_URL`: Browser-facing backend origin used by the frontend.
- `PORT`: Backend HTTP port.
- `CORS_ORIGIN`: Allowed frontend origin for local development.
- `DATABASE_URL`: PostgreSQL connection string reserved for the future data layer.
- `GROQ_API_KEY`: Required for the Interviewer Decision Engine and feedback report generation. Groq has a free tier: https://console.groq.com/keys.
- `DECISION_ENGINE_MODEL`: Groq model used for interviewer decisions and feedback generation. Defaults to `openai/gpt-oss-120b`.
- `DECISION_ENGINE_REASONING_EFFORT`: Reasoning depth passed to the model (`low` | `medium` | `high`). Defaults to `high`.
- `STT_MODEL`: Groq Whisper model used to transcribe candidate speech. Defaults to `whisper-large-v3-turbo`.
- `VOICE_PROVIDER`: Text-to-speech provider. Defaults to `openai` for the most natural interviewer voice. Set to `groq` only for the older Groq/Orpheus path.
- `OPENAI_API_KEY`: Required when `VOICE_PROVIDER=openai`.
- `OPENAI_TTS_MODEL`: OpenAI text-to-speech model. Defaults to `gpt-4o-mini-tts`.
- `OPENAI_TTS_VOICE`: OpenAI text-to-speech voice. Defaults to `marin`.
- `OPENAI_TTS_INSTRUCTIONS`: Voice direction for tone, pacing, and delivery.
- `TTS_MODEL`: Groq Orpheus model used only when `VOICE_PROVIDER=groq`. Defaults to `canopylabs/orpheus-v1-english`.
- `TTS_VOICE`: Groq Orpheus voice name used only when `VOICE_PROVIDER=groq`. Defaults to `troy`.

Do not commit real `.env` files.
