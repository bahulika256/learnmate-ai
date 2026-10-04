import { useEffect, useRef, useState } from 'react';
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
} from '@google/genai';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
} from 'lucide-react';
import { getGeminiLiveToken } from '../lib/geminiLive';

type LiveVoiceProps = {
  subject?: string;
  language?: string;
};

export default function LiveVoice({
  subject = 'Mathematics',
  language = 'English',
}: LiveVoiceProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Ready to start');

  const sessionRef = useRef<any>(null);

  const audioContextRef =
    useRef<AudioContext | null>(null);

  const mediaStreamRef =
    useRef<MediaStream | null>(null);

  const sourceRef =
    useRef<MediaStreamAudioSourceNode | null>(null);

  const processorRef =
    useRef<ScriptProcessorNode | null>(null);

  const nextAudioTimeRef = useRef(0);

  const audioSourcesRef =
    useRef<AudioBufferSourceNode[]>([]);

  const connectedRef =
    useRef(false);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  async function createAudioContext() {
    if (!audioContextRef.current) {
      audioContextRef.current =
        new AudioContext({
          sampleRate: 16000,
        });
    }

    if (
      audioContextRef.current.state ===
      'suspended'
    ) {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }

  function base64ToUint8Array(
    base64: string
  ) {
    const binary = atob(base64);

    const bytes =
      new Uint8Array(binary.length);

    for (
      let i = 0;
      i < binary.length;
      i++
    ) {
      bytes[i] =
        binary.charCodeAt(i);
    }

    return bytes;
  }

  function pcmToAudioBuffer(
    audioContext: AudioContext,
    base64: string,
    sampleRate = 24000
  ) {
    const bytes =
      base64ToUint8Array(base64);

    const int16 = new Int16Array(
      bytes.buffer,
      bytes.byteOffset,
      Math.floor(
        bytes.byteLength / 2
      )
    );

    const audioBuffer =
      audioContext.createBuffer(
        1,
        int16.length,
        sampleRate
      );

    const channelData =
      audioBuffer.getChannelData(0);

    for (
      let i = 0;
      i < int16.length;
      i++
    ) {
      channelData[i] =
        int16[i] / 32768;
    }

    return audioBuffer;
  }

  async function playAudioChunk(
    base64: string
  ) {
    const audioContext =
      await createAudioContext();

    const audioBuffer =
      pcmToAudioBuffer(
        audioContext,
        base64,
        24000
      );

    const source =
      audioContext.createBufferSource();

    source.buffer = audioBuffer;

    source.connect(
      audioContext.destination
    );

    const startTime =
      Math.max(
        audioContext.currentTime,
        nextAudioTimeRef.current
      );

    source.start(startTime);

    nextAudioTimeRef.current =
      startTime +
      audioBuffer.duration;

    audioSourcesRef.current.push(
      source
    );

    source.onended = () => {
      audioSourcesRef.current =
        audioSourcesRef.current.filter(
          (item) =>
            item !== source
        );

      if (
        audioSourcesRef.current
          .length === 0
      ) {
        setIsSpeaking(false);

        if (connectedRef.current) {
          setIsListening(true);
          setStatus('Listening...');
        }
      }
    };

    setIsSpeaking(true);
    setIsListening(false);
    setStatus(
      'LearnMate is speaking...'
    );
  }

  function arrayBufferToBase64(
    buffer: ArrayBuffer
  ) {
    const bytes =
      new Uint8Array(buffer);

    let binary = '';

    const chunkSize = 0x8000;

    for (
      let i = 0;
      i < bytes.length;
      i += chunkSize
    ) {
      const chunk =
        bytes.subarray(
          i,
          Math.min(
            i + chunkSize,
            bytes.length
          )
        );

      binary += String.fromCharCode(
        ...chunk
      );
    }

    return btoa(binary);
  }

  function sendAudio(
    base64Audio: string
  ) {
    const session =
      sessionRef.current;

    if (!session) return;

    session.sendRealtimeInput({
      audio: {
        data: base64Audio,
        mimeType:
          'audio/pcm;rate=16000',
      },
    });
  }

  async function startMicrophone() {
    const audioContext =
      await createAudioContext();

    const stream =
      await navigator.mediaDevices.getUserMedia(
        {
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }
      );

    mediaStreamRef.current =
      stream;

    const source =
      audioContext.createMediaStreamSource(
        stream
      );

    sourceRef.current =
      source;

    const processor =
      audioContext.createScriptProcessor(
        4096,
        1,
        1
      );

    processorRef.current =
      processor;

    processor.onaudioprocess =
      (event) => {
        const inputData =
          event.inputBuffer.getChannelData(
            0
          );

        const pcmData =
          new Int16Array(
            inputData.length
          );

        for (
          let i = 0;
          i < inputData.length;
          i++
        ) {
          const sample =
            Math.max(
              -1,
              Math.min(
                1,
                inputData[i]
              )
            );

          pcmData[i] =
            sample < 0
              ? sample * 32768
              : sample * 32767;
        }

        sendAudio(
          arrayBufferToBase64(
            pcmData.buffer
          )
        );
      };

    source.connect(processor);

    processor.connect(
      audioContext.destination
    );
  }

  function stopMicrophone() {
    if (processorRef.current) {
      processorRef.current.disconnect();

      processorRef.current.onaudioprocess =
        null;

      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();

      sourceRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      mediaStreamRef.current =
        null;
    }
  }

  async function connect() {
    try {
      setIsConnecting(true);
      setStatus(
        'Connecting to Live Voice...'
      );

      const token =
        await getGeminiLiveToken();

      const ai =
        new GoogleGenAI({
          apiKey: token,
        });

      const session =
        await ai.live.connect({
          model:
            'gemini-3.8-live',

          config: {
            responseModalities: [
              Modality.AUDIO,
            ],

            systemInstruction: `
You are LearnMate AI, a friendly personal AI teacher.

The student is currently learning:

Subject: ${subject}

Preferred language: ${language}

Teach clearly and patiently.

Give short spoken explanations first.

Ask questions when helpful.

If the student is confused,
explain the concept in a simpler way.

Use examples appropriate for a school student.

The student is speaking with you
using real-time voice.

Respond naturally and conversationally.
            `,

            inputAudioTranscription: {},
            outputAudioTranscription: {},

            sessionResumption: {},
          },

          callbacks: {
            onopen: () => {
              connectedRef.current =
                true;

              setStatus(
                'Listening...'
              );

              setIsConnected(true);
              setIsConnecting(false);
              setIsListening(true);
            },

            onmessage: async (
              message: LiveServerMessage
            ) => {
              const content =
                message.serverContent;

              if (
                content?.modelTurn
                  ?.parts
              ) {
                for (
                  const part of
                    content.modelTurn
                      .parts
                ) {
                  if (
                    part.inlineData
                      ?.data
                  ) {
                    await playAudioChunk(
                      part.inlineData
                        .data
                    );
                  }
                }
              }

              if (
                content?.interrupted
              ) {
                audioSourcesRef.current.forEach(
                  (source) => {
                    try {
                      source.stop();
                    } catch {
                      // Already stopped.
                    }
                  }
                );

                audioSourcesRef.current =
                  [];

                nextAudioTimeRef.current =
                  0;

                setIsSpeaking(false);

                if (
                  connectedRef.current
                ) {
                  setStatus(
                    'Listening...'
                  );

                  setIsListening(
                    true
                  );
                }
              }

              if (
                content?.turnComplete &&
                audioSourcesRef.current
                  .length === 0
              ) {
                setStatus(
                  'Listening...'
                );

                setIsListening(true);
              }
            },

            onerror: (
              error: unknown
            ) => {
              console.error(
                'Gemini Live error:',
                error
              );

              connectedRef.current =
                false;

              setStatus(
                'Live Voice connection error'
              );

              setIsConnecting(false);
              setIsConnected(false);
              setIsListening(false);
            },

            onclose: () => {
              connectedRef.current =
                false;

              setStatus(
                'Disconnected'
              );

              setIsConnected(false);
              setIsConnecting(false);
              setIsListening(false);
            },
          },
        });

      sessionRef.current =
        session;

      await startMicrophone();
    } catch (error) {
      console.error(
        'Failed to start Live Voice:',
        error
      );

      connectedRef.current =
        false;

      setStatus(
        error instanceof Error
          ? error.message
          : 'Could not start Live Voice.'
      );

      setIsConnecting(false);
      setIsConnected(false);
      setIsListening(false);

      stopMicrophone();
    }
  }

  function disconnect() {
    stopMicrophone();

    audioSourcesRef.current.forEach(
      (source) => {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
      }
    );

    audioSourcesRef.current =
      [];

    nextAudioTimeRef.current =
      0;

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch {
        // Already closed.
      }

      sessionRef.current =
        null;
    }

    connectedRef.current =
      false;

    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setIsListening(false);
    setStatus('Ready to start');
  }

  return (
    <div className="w-full rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-purple-50 px-3 py-3 shadow-sm">

      <div className="flex items-center gap-3">

        {/* Voice icon */}
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            isSpeaking
              ? 'bg-indigo-600 text-white shadow-md'
              : isListening
              ? 'bg-purple-600 text-white'
              : 'bg-white text-slate-500 border border-slate-200'
          }`}
        >
          {isSpeaking ? (
            <Volume2 size={21} />
          ) : isListening ? (
            <Mic size={21} />
          ) : (
            <MicOff size={21} />
          )}
        </div>

        {/* Title and status */}
        <div className="min-w-0 shrink-0">

          <p className="text-sm font-bold text-slate-900">
            Live Voice
          </p>

          <p className="text-xs text-slate-500">
            {status}
          </p>

        </div>

        {/* Waveform */}
        <div className="hidden flex-1 items-center justify-center gap-1 sm:flex">

          {[
            10,
            18,
            28,
            40,
            52,
            40,
            28,
            18,
            10,
          ].map(
            (height, index) => (
              <div
                key={index}
                className={`w-1 rounded-full transition-all ${
                  isSpeaking
                    ? 'bg-indigo-600 animate-pulse'
                    : isListening
                    ? 'bg-purple-400 animate-pulse'
                    : 'bg-slate-300'
                }`}
                style={{
                  height: isConnected
                    ? `${height}px`
                    : '7px',

                  animationDelay:
                    `${index * 70}ms`,

                  animationDuration:
                    isSpeaking
                      ? `${450 + index * 60}ms`
                      : '1100ms',
                }}
              />
            )
          )}

        </div>

        {/* Status on mobile */}
        <div className="flex-1 sm:hidden">
          <span className="text-xs text-slate-500">
            {isSpeaking
              ? 'Speaking'
              : isListening
              ? 'Listening'
              : 'Voice tutor'}
          </span>
        </div>

        {/* Controls */}
        {!isConnected ? (
          <button
            type="button"
            onClick={connect}
            disabled={isConnecting}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Phone size={16} />

            <span className="hidden sm:inline">
              {isConnecting
                ? 'Connecting...'
                : 'Start Voice'}
            </span>

            <span className="sm:hidden">
              {isConnecting
                ? '...'
                : 'Start'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={disconnect}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
          >
            <PhoneOff size={16} />

            <span className="hidden sm:inline">
              End Voice
            </span>

            <span className="sm:hidden">
              End
            </span>
          </button>
        )}

      </div>

      {/* Small active hint */}
      {isConnected && (
        <div className="mt-2 hidden text-center text-[11px] text-slate-400 sm:block">
          Speak naturally — you can interrupt LearnMate while it is speaking.
        </div>
      )}

    </div>
  );
}