import { useCallback, useEffect, useRef, useState } from 'react';

const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const SILENCE_THRESHOLD = 0.035;
const SILENCE_DELAY_MS = 900;
const MIN_SPEECH_MS = 500;
const MAX_SPEECH_MS = 20_000;
const SAMPLE_INTERVAL_MS = 100;

const pickSupportedMimeType = (): string | undefined =>
  PREFERRED_MIME_TYPES.find(
    (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type),
  );

type StartOptions = {
  autoStop?: boolean;
  onAutoStop?: (blob: Blob | undefined) => void;
};

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sampleTimerRef = useRef<number | null>(null);
  const sampleDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const stopSilenceDetection = useCallback(() => {
    if (sampleTimerRef.current !== null) {
      window.clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
    analyserRef.current = null;
    sampleDataRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
  }, []);

  const stop = useCallback((): Promise<Blob | undefined> => {
    return new Promise((resolve) => {
      stopSilenceDetection();

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setIsRecording(false);
        resolve(undefined);
        return;
      }

      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: recorder.mimeType })
            : undefined;
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);
        resolve(blob);
      };
      recorder.stop();
    });
  }, [stopSilenceDetection]);

  const startSilenceDetection = useCallback(
    (stream: MediaStream, onAutoStop?: (blob: Blob | undefined) => void) => {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);

      audioContextRef.current = context;
      analyserRef.current = analyser;
      sampleDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

      let hasHeardSpeech = false;
      let firstSpeechAt = 0;
      let lastSpeechAt = 0;

      sampleTimerRef.current = window.setInterval(() => {
        const data = sampleDataRef.current;
        const currentAnalyser = analyserRef.current;
        if (!data || !currentAnalyser) return;

        currentAnalyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let index = 0; index < data.length; index += 1) {
          const normalized = (data[index] ?? 128) / 128 - 1;
          sumSquares += normalized * normalized;
        }

        const now = Date.now();
        const level = Math.sqrt(sumSquares / data.length);

        if (level > SILENCE_THRESHOLD) {
          hasHeardSpeech = true;
          firstSpeechAt = firstSpeechAt || now;
          lastSpeechAt = now;
          return;
        }

        if (!hasHeardSpeech) return;

        const hasMinimumSpeech = now - firstSpeechAt >= MIN_SPEECH_MS;
        const silenceExpired = now - lastSpeechAt >= SILENCE_DELAY_MS;
        const maxDurationExpired = now - firstSpeechAt >= MAX_SPEECH_MS;

        if ((hasMinimumSpeech && silenceExpired) || maxDurationExpired) {
          void stop().then(onAutoStop);
        }
      }, SAMPLE_INTERVAL_MS);
    },
    [stop],
  );

  const start = useCallback(
    async (options: StartOptions = {}) => {
      setError(undefined);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mimeType = pickSupportedMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);

        if (options.autoStop) {
          startSilenceDetection(stream, options.onAutoStop);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Microphone access was denied.');
        setIsRecording(false);
      }
    },
    [startSilenceDetection],
  );

  useEffect(() => {
    return () => {
      stopSilenceDetection();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [stopSilenceDetection]);

  return { isRecording, error, start, stop };
}
