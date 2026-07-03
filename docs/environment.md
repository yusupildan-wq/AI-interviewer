# Environment

The root `.env.example` documents the complete local environment. App-specific examples live in `frontend/.env.example` and `backend/.env.example`.

## Variables

- `VITE_API_BASE_URL`: Browser-facing backend origin used by the frontend.
- `PORT`: Backend HTTP port.
- `CORS_ORIGIN`: Allowed frontend origin for local development.
- `DATABASE_URL`: PostgreSQL connection string. Required — users, interview sessions, and feedback reports are persisted here via Drizzle ORM. Run `npm run db:migrate -w backend` after pointing this at a fresh database.
- `SESSION_SECRET`: Signs and encrypts the auth session cookie (`cookie-parser`'s signed-cookie secret). Falls back to an insecure dev-only value outside production; the backend refuses to start in production without it. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `GROQ_API_KEY`: Used for speech-to-text (Whisper) only. Groq has a free tier: https://console.groq.com/keys.
- `STT_MODEL`: Groq Whisper model used to transcribe candidate speech. Defaults to `whisper-large-v3-turbo`.
- `DECISION_ENGINE_MODEL`: OpenAI model used for interviewer decisions and feedback generation. Defaults to `gpt-4o-mini`. Moved off Groq because Groq's free-tier TPM cap throttled after 1-2 real conversational turns; OpenAI held up over repeated rapid requests in testing.
- `DECISION_ENGINE_TIMEOUT_MS`: Safety-net timeout (ms) for a single decision-engine call before falling back to a generic reply — not a routine truncation. Defaults to `10000`.
- `VOICE_PROVIDER`: Text-to-speech provider. Defaults to `openai` for the most natural interviewer voice. Set to `groq` only for the older Groq/Orpheus path.
- `OPENAI_API_KEY`: Required for the Interviewer Decision Engine, feedback generation, and (when `VOICE_PROVIDER=openai`) text-to-speech.
- `OPENAI_TTS_MODEL`: OpenAI text-to-speech model. Defaults to `gpt-4o-mini-tts`.
- `OPENAI_TTS_VOICE`: OpenAI text-to-speech voice. Defaults to `marin`.
- `OPENAI_TTS_INSTRUCTIONS`: Voice direction for tone, pacing, and delivery.
- `TTS_MODEL`: Groq Orpheus model used only when `VOICE_PROVIDER=groq`. Defaults to `canopylabs/orpheus-v1-english`.
- `TTS_VOICE`: Groq Orpheus voice name used only when `VOICE_PROVIDER=groq`. Defaults to `troy`.

Do not commit real `.env` files.
