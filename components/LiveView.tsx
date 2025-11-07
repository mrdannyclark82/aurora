import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob } from "@google/genai";
import { MicIcon } from './icons/MicIcon';
import { useError } from '../contexts/ErrorContext';
import { useMobileNav } from '../contexts/MobileNavContext';
import { MenuIcon } from './icons/MenuIcon';
import { useSettings } from '../contexts/SettingsContext';
import { VideoCameraIcon } from './icons/VideoCameraIcon';
import { fileToBase64 } from '../utils/fileUtils'; // We can reuse this for blob-to-base64

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the "data:mime/type;base64," prefix
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = (error) => reject(error);
    });
};


const encode = (bytes: Uint8Array): string => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

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
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
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


interface TranscriptionTurn {
    id: string;
    userInput: string;
    modelOutput: string;
}

const FRAME_RATE = 1; // Send 1 frame per second
const JPEG_QUALITY = 0.7;

export const LiveView: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Click start to begin the conversation');
    const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionTurn[]>([]);
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    
    const { setError } = useError();
    const { toggleMobileNav } = useMobileNav();
    const { memory } = useSettings();
    
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameIntervalRef = useRef<number | null>(null);

    const stopSession = useCallback(() => {
        setIsSessionActive(false);

        sessionPromiseRef.current?.then((session) => {
            session.close();
            sessionPromiseRef.current = null;
        });

        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }

        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        
        if (inputAudioContextRef.current?.state !== 'closed') inputAudioContextRef.current?.close();
        if (outputAudioContextRef.current?.state !== 'closed') outputAudioContextRef.current?.close();

        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;

        setStatusMessage('Click start to begin the conversation');
    }, []);

    const startSession = useCallback(async () => {
        setIsSessionActive(true);
        setStatusMessage('Initializing session...');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideoEnabled });
            mediaStreamRef.current = stream;

            if (isVideoEnabled && videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            let nextStartTime = 0;
            const sources = new Set<AudioBufferSourceNode>();
            
            const memoryFacts = memory.map(m => `- ${m.fact}`).join('\n');
            const systemInstruction = `You are a friendly and helpful AI assistant. Here are some facts to remember about the user:\n${memoryFacts}\nKeep your responses conversational and concise.`;


            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setStatusMessage('Listening...');
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        mediaStreamSourceRef.current = source;
                        
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
                            const pcmBlob: GenAiBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromiseRef.current?.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);

                        if (isVideoEnabled && videoRef.current && canvasRef.current) {
                            const videoEl = videoRef.current;
                            const canvasEl = canvasRef.current;
                            const ctx = canvasEl.getContext('2d');
                            frameIntervalRef.current = window.setInterval(() => {
                                if (ctx && videoEl.readyState >= videoEl.HAVE_CURRENT_DATA) {
                                    canvasEl.width = videoEl.videoWidth;
                                    canvasEl.height = videoEl.videoHeight;
                                    ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
                                    canvasEl.toBlob(
                                      async (blob) => {
                                        if (blob) {
                                          const base64Data = await blobToBase64(blob);
                                          sessionPromiseRef.current?.then((session) => {
                                            session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                                          });
                                        }
                                      },
                                      'image/jpeg',
                                      JPEG_QUALITY
                                    );
                                }
                            }, 1000 / FRAME_RATE);
                        }
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.outputTranscription) currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        if (message.serverContent?.inputTranscription) currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        
                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscriptionRef.current;
                            const fullOutput = currentOutputTranscriptionRef.current;
                            if (fullInput.trim() || fullOutput.trim()) {
                                setTranscriptionHistory(prev => [...prev, { id: Date.now().toString(), userInput: fullInput, modelOutput: fullOutput }]);
                            }
                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio) {
                            const audioCtx = outputAudioContextRef.current!;
                            nextStartTime = Math.max(nextStartTime, audioCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
                            const sourceNode = audioCtx.createBufferSource();
                            sourceNode.buffer = audioBuffer;
                            sourceNode.connect(audioCtx.destination);
                            sourceNode.addEventListener('ended', () => sources.delete(sourceNode));
                            sourceNode.start(nextStartTime);
                            nextStartTime += audioBuffer.duration;
                            sources.add(sourceNode);
                        }
                        
                        if(message.serverContent?.interrupted){
                            for (const sourceNode of sources.values()) {
                                sourceNode.stop();
                                sources.delete(sourceNode);
                            }
                            nextStartTime = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error:', e);
                        setError(`Live session error: ${e.message || 'An unknown error occurred.'}`);
                        stopSession();
                    },
                    onclose: () => setStatusMessage('Session closed. Click start to begin again.'),
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: systemInstruction,
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                },
            });
            await sessionPromiseRef.current;

        } catch (error: any) {
            console.error('Failed to start session:', error);
            const errorMessage = error.name === 'NotAllowedError' 
                ? 'Camera/Microphone access was denied. Please allow permissions in your browser settings.'
                : 'Could not access camera/microphone or start the session. Please check your connection and permissions.';
            setError(errorMessage);
            setStatusMessage('Failed to start session.');
            setIsSessionActive(false);
        }
    }, [setError, stopSession, isVideoEnabled, memory]);
    
    return (
        <div className="flex flex-col h-full w-full bg-secondary text-text-primary">
            <header className="p-4 border-b border-border flex items-center">
                <button onClick={toggleMobileNav} className="mr-4 md-hidden" aria-label="Open navigation menu">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <div>
                    <h2 className="text-xl font-bold">Live Conversation</h2>
                    <p className="text-sm text-text-secondary">Talk to and show Aura things in real-time.</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 relative">
               {isVideoEnabled && (
                <div className="absolute top-4 right-4 w-1/4 max-w-xs aspect-video rounded-lg overflow-hidden border-2 border-border z-10">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform -scale-x-100" />
                </div>
               )}
               <canvas ref={canvasRef} className="hidden" />
               {transcriptionHistory.map(turn => (
                 <div key={turn.id} className="space-y-2">
                    {turn.userInput && (
                         <div className="flex justify-end">
                            <p className="bg-accent text-white p-3 rounded-2xl rounded-br-none max-w-xl">{turn.userInput}</p>
                        </div>
                    )}
                    {turn.modelOutput && (
                         <div className="flex justify-start">
                            <p className="bg-primary text-text-primary p-3 rounded-2xl rounded-bl-none max-w-xl">{turn.modelOutput}</p>
                        </div>
                    )}
                 </div>
               ))}
               {transcriptionHistory.length === 0 && !isSessionActive && (
                <div className="text-center text-text-secondary pt-24">
                    <h3 className="text-lg font-semibold">Real-time Conversation</h3>
                    <p>Click the microphone button to start talking to Aura.</p>
                </div>
               )}
            </main>
            <footer className="p-4 border-t border-border bg-secondary flex flex-col items-center justify-center">
                 <p className="text-sm text-text-secondary mb-4 h-5">{statusMessage}</p>
                 <div className="flex items-center gap-6">
                    <button
                        onClick={isSessionActive ? stopSession : startSession}
                        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${isSessionActive ? 'bg-red-500 animate-pulse-fast' : 'bg-accent'}`}>
                        <MicIcon className="w-10 h-10 text-white" />
                    </button>
                    <div className="absolute right-6 flex flex-col items-center gap-1">
                        <label htmlFor="video-toggle" className="text-xs text-text-secondary">Video</label>
                        <button
                            id="video-toggle"
                            role="switch"
                            aria-checked={isVideoEnabled}
                            onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                            disabled={isSessionActive}
                            className={`${isVideoEnabled ? 'bg-accent' : 'bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 disabled:opacity-50`}
                        >
                            <span className={`${isVideoEnabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
                        </button>
                    </div>
                 </div>
            </footer>
        </div>
    );
};