import { useCallback, useState } from 'react';

/**
 * Free, zero-setup voice output via the browser's built-in SpeechSynthesis API.
 * Used as the fallback when the higher-quality Groq TTS call fails or isn't
 * available (e.g. pending model-terms acceptance on the Groq account).
 */
export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback(
    (text: string): Promise<void> =>
      new Promise((resolve, reject) => {
        if (!isSupported) {
          reject(new Error('Speech synthesis is not supported in this browser.'));
          return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          resolve();
        };
        utterance.onerror = (event) => {
          setIsSpeaking(false);
          reject(new Error(event.error || 'Speech synthesis failed.'));
        };

        window.speechSynthesis.speak(utterance);
      }),
    [isSupported],
  );

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [isSupported]);

  return { isSpeaking, isSupported, speak, stop };
}
