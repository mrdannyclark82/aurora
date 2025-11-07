import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceOption } from '../types';
import { generateSpeech } from '../services/geminiService';
import { useError } from '../contexts/ErrorContext';
import { useSettings } from '../contexts/SettingsContext';

// Audio decoding utilities
const decode = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
): Promise<AudioBuffer> {
    // Gemini TTS uses 24000 sample rate and 1 channel
    const sampleRate = 24000;
    const numChannels = 1;

    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


// Gemini TTS voices
export const geminiVoices: VoiceOption[] = [
    { name: 'Zephyr', lang: 'en-US', uri: 'Zephyr' },
    { name: 'Kore', lang: 'en-US', uri: 'Kore' },
    { name: 'Puck', lang: 'en-US', uri: 'Puck' },
    { name: 'Charon', lang: 'en-US', uri: 'Charon' },
    { name: 'Fenrir', lang: 'en-US', uri: 'Fenrir' },
];


export const useTextToSpeech = () => {
    const [voices] = useState<VoiceOption[]>(geminiVoices);
    const { selectedVoice } = useSettings();
    const [isPlaying, setIsPlaying] = useState(false);
    const { setError } = useError();
    
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);

    const isSupported = typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);

    useEffect(() => {
        if (isSupported && !audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        return () => {
            cancel();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSupported]);
    
    const cancel = useCallback(() => {
        if (sourceRef.current) {
            sourceRef.current.stop();
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        setIsPlaying(false);
    }, []);

    const speak = useCallback(async (text: string) => {
        if (!isSupported || !selectedVoice || !text.trim()) return;
        
        cancel(); // Stop any currently playing audio
        setIsPlaying(true);
        
        try {
            // Fix: Destructure base64Audio from the response object.
            const { base64Audio } = await generateSpeech(text, selectedVoice);
            const audioCtx = audioContextRef.current;
            if (!audioCtx) {
                throw new Error("Audio context not available.");
            }
             // Ensure context is running
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            const decodedBytes = decode(base64Audio);
            const audioBuffer = await decodeAudioData(decodedBytes, audioCtx);
            
            const source = audioCtx.createBufferSource();
            sourceRef.current = source;
            source.buffer = audioBuffer;
            source.connect(audioCtx.destination);
            source.onended = () => {
                setIsPlaying(false);
                sourceRef.current = null;
            };
            source.start();

        } catch (error: any) {
            console.error('Gemini TTS Error:', error);
            setError(error.message || 'Failed to play audio.');
            setIsPlaying(false);
        }
    }, [isSupported, selectedVoice, cancel, setError]);


    return { isSupported, isPlaying, voices, speak, cancel };
};
