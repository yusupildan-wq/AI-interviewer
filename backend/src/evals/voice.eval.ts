import { readFileSync } from 'node:fs';

const voiceServiceSource = readFileSync(
  new URL('../features/voice/voice.service.ts', import.meta.url),
  'utf8',
);

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const evalOpenAiSpeechUsesCompressedAudio = (): void => {
  assert(
    voiceServiceSource.includes("OPENAI_SPEECH_RESPONSE_FORMAT = 'mp3'"),
    'OpenAI speech should default to compressed MP3 for lower playback latency.',
  );
  assert(
    voiceServiceSource.includes("contentType: 'audio/mpeg'"),
    'OpenAI speech route should return an audio/mpeg content type.',
  );
};

const evalGroqFallbackKeepsWav = (): void => {
  assert(
    voiceServiceSource.includes("GROQ_SPEECH_RESPONSE_FORMAT = 'wav'"),
    'Groq speech fallback should keep its supported WAV format.',
  );
  assert(
    voiceServiceSource.includes("contentType: 'audio/wav'"),
    'Groq speech fallback should return an audio/wav content type.',
  );
};

const evals = [
  ['OpenAI speech uses compressed audio', evalOpenAiSpeechUsesCompressedAudio],
  ['Groq speech fallback keeps WAV', evalGroqFallbackKeepsWav],
] as const;

for (const [name, run] of evals) {
  run();
  console.log(`PASS ${name}`);
}

console.log(`\n${evals.length} voice evals passed.`);
