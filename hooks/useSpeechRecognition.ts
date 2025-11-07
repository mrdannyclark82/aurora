import { useState, useEffect, useRef, useCallback } from 'react';

// Fix: Add types for the Web Speech API to resolve 'Cannot find name' errors.
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onstart: () => void;
  onend: () => void;
  onerror: (event: any) => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList extends ArrayLike<SpeechRecognitionResult> {}
interface SpeechRecognitionResult extends ArrayLike<{ transcript: string }> {}

const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported = !!SpeechRecognitionAPI;

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const start = useCallback(() => {
    if (isListening || !isSupported) return;

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;
    
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
        const result = Array.from(event.results)
            .map(r => r[0])
            .map(t => t.transcript)
            .join('');
        setTranscript(result);
    };
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
    };
    recognition.onerror = (e) => {
        console.error("Speech Recognition Error", e);
        if (e.error !== 'no-speech') {
          stop();
        }
    };

    recognition.start();
  }, [isSupported, isListening, stop]);
  
  const toggleListening = useCallback(() => {
      if (isListening) {
          stop();
      } else {
          start();
      }
  }, [isListening, start, stop]);
  
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return { isSupported, isListening, transcript, toggleListening, setTranscript };
};