import { useCallback, useMemo, useRef, useState } from 'react';

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): { readonly transcript: string };
  [index: number]: { readonly transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    item(index: number): SpeechRecognitionResultLike;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = Event & {
  readonly error: string;
};

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type StartOptions = {
  onFinalTranscript: (text: string) => void;
};

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | undefined => {
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
};

export function useLiveSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const interimTimerRef = useRef<number | null>(null);
  const finalizedRef = useRef(false);
  const isSupported = typeof window !== 'undefined' && Boolean(getSpeechRecognitionConstructor());

  const stop = useCallback(() => {
    if (interimTimerRef.current !== null) {
      window.clearTimeout(interimTimerRef.current);
      interimTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    finalizedRef.current = false;
    setIsListening(false);
  }, []);

  const start = useCallback((options: StartOptions) => {
    if (recognitionRef.current) return;

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setError('Live speech recognition is not available in this browser.');
      return;
    }

    setError(undefined);
    finalizedRef.current = false;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    const finish = (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || finalizedRef.current) return;
      finalizedRef.current = true;
      if (interimTimerRef.current !== null) {
        window.clearTimeout(interimTimerRef.current);
        interimTimerRef.current = null;
      }
      const activeRecognition = recognitionRef.current;
      recognitionRef.current = null;
      setIsListening(false);
      activeRecognition?.stop();
      options.onFinalTranscript(trimmed);
    };

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index] ?? event.results.item(index);
        const transcript = result[0]?.transcript ?? result.item(0).transcript;
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalText.trim()) {
        finish(finalText);
        return;
      }

      const trimmedInterim = interimText.trim();
      if (trimmedInterim) {
        if (interimTimerRef.current !== null) {
          window.clearTimeout(interimTimerRef.current);
        }
        // Long enough that a normal thinking pause or breath mid-sentence doesn't get
        // mistaken for "done talking" and cut the candidate off — this only fires once
        // the browser has gone a genuine beat without any new interim text at all. Most
        // browsers mark a result isFinal on their own well before this fallback fires;
        // this is just the backstop for when that native signal doesn't come.
        interimTimerRef.current = window.setTimeout(() => {
          finish(trimmedInterim);
        }, 1100);
      }
    };

    recognition.onerror = (event) => {
      if (interimTimerRef.current !== null) {
        window.clearTimeout(interimTimerRef.current);
        interimTimerRef.current = null;
      }
      recognitionRef.current = null;
      finalizedRef.current = false;
      setIsListening(false);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(event.error);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      finalizedRef.current = false;
      setIsListening(false);
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (caught) {
      recognitionRef.current = null;
      finalizedRef.current = false;
      setIsListening(false);
      setError(caught instanceof Error ? caught.message : 'Could not start live speech.');
    }
  }, []);

  return useMemo(
    () => ({ isSupported, isListening, error, start, stop }),
    [error, isListening, isSupported, start, stop],
  );
}
