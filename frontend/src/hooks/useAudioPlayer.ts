import { useCallback, useRef, useState } from 'react';

export function useAudioPlayer() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [level, setLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopLevelLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setLevel(0);
  }, []);

  const sampleLevel = useCallback(() => {
    const analyser = analyserRef.current;
    const data = dataRef.current;
    if (!analyser || !data) return;

    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i += 1) {
      const normalized = (data[i] ?? 128) / 128 - 1;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    setLevel(Math.min(1, rms * 4));

    rafRef.current = requestAnimationFrame(sampleLevel);
  }, []);

  const play = useCallback(
    (blob: Blob): Promise<void> => {
      return new Promise((resolve, reject) => {
        audioRef.current?.pause();
        stopLevelLoop();
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
        }

        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audio.crossOrigin = 'anonymous';
        audioRef.current = audio;

        // Tap the element into a Web Audio graph so we can read real amplitude and
        // drive the avatar's mouth in sync with the actual voice, not a fake loop.
        try {
          const AudioContextCtor = window.AudioContext;
          const context = audioContextRef.current ?? new AudioContextCtor();
          audioContextRef.current = context;
          if (context.state === 'suspended') {
            void context.resume();
          }

          const analyser = context.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;
          dataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

          const source = context.createMediaElementSource(audio);
          source.connect(analyser);
          analyser.connect(context.destination);
        } catch {
          // Analysis is a nice-to-have for the avatar's mouth animation — if the Web
          // Audio graph can't be set up, audio still plays via the element directly.
        }

        audio.onplay = () => {
          setIsSpeaking(true);
          rafRef.current = requestAnimationFrame(sampleLevel);
        };
        audio.onended = () => {
          setIsSpeaking(false);
          stopLevelLoop();
          URL.revokeObjectURL(url);
          if (urlRef.current === url) {
            urlRef.current = null;
          }
          resolve();
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          stopLevelLoop();
          reject(new Error('Audio playback failed.'));
        };

        audio.play().catch((caught: unknown) => {
          setIsSpeaking(false);
          stopLevelLoop();
          reject(caught instanceof Error ? caught : new Error('Audio playback failed.'));
        });
      });
    },
    [sampleLevel, stopLevelLoop],
  );

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setIsSpeaking(false);
    stopLevelLoop();
  }, [stopLevelLoop]);

  return { isSpeaking, level, play, stop };
}
