import type { Dispatch, SetStateAction } from "react";
import { useState, useCallback, useRef } from "react";
import {
  type TranscriptionSegment,
  type AudioSettings,
  DEFAULT_AUDIO_SETTINGS,
} from "@/types/voice2sense";
import { toast } from "sonner";
import { analyzeText as analyzeTextApi } from "@/integrations/api/analyzeClient";

interface UseTranscriptionOptions {
  sourceLanguage: string;
  targetLanguages: string[];
  /** Shared with the page so translations from /analyze update the same list shown in CaptionDisplay. */
  setSegments: Dispatch<SetStateAction<TranscriptionSegment[]>>;
  audioSettings?: AudioSettings;
  privacyMode?: boolean;
  expertMode?: string;
  onSegmentComplete?: (segment: TranscriptionSegment) => void;
  onVolumePeak?: () => void;
}

/** Real-time analysis via Express backend (Groq `/analyze`). */
export async function analyzeText(
  text: string,
  sourceLanguage: string,
  targetLanguages: string[],
  expertMode: string = "Normal"
) {
  return analyzeTextApi(text, sourceLanguage, targetLanguages, expertMode);
}

export const useTranscription = ({
  sourceLanguage,
  targetLanguages,
  setSegments,
  audioSettings = DEFAULT_AUDIO_SETTINGS,
  expertMode = 'Normal',
  privacyMode = false,
  onSegmentComplete,
  onVolumePeak,
}: UseTranscriptionOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [partialText, setPartialText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const targetLanguagesRef = useRef(targetLanguages);
  const sourceLanguageRef = useRef(sourceLanguage);
  const privacyModeRef = useRef(privacyMode);
  const expertModeRef = useRef(expertMode);
  targetLanguagesRef.current = targetLanguages;
  sourceLanguageRef.current = sourceLanguage;
  privacyModeRef.current = privacyMode;
  expertModeRef.current = expertMode;

  const mediaRecorderRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const startRecording = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: audioSettings.echoCancellation,
          noiseSuppression: audioSettings.noiseSuppression,
          autoGainControl: audioSettings.autoGainControl,
        },
      });

      streamRef.current = stream;

      // Volume Analysis Setup
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        if (!streamRef.current || !analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        if (average > 100 && onVolumePeak) {
          onVolumePeak();
        }
        requestAnimationFrame(checkVolume);
      };
      checkVolume();

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        throw new Error("Speech recognition not supported.");
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      // Listen for the native script you selected (e.g., 'te-IN' for Telugu)
      recognition.lang = getLanguageCode(sourceLanguage);

      recognition.onstart = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setIsRecording(true);
        toast.success(`Listening in ${sourceLanguage.toUpperCase()}`);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setPartialText(interimTranscript);

        if (finalTranscript) {
          const segmentId = `seg-${Date.now()}`;

          const newSegment: TranscriptionSegment = {
            id: segmentId,
            text: finalTranscript.trim(),
            timestamp: new Date(),
            language: sourceLanguageRef.current,
            speaker: "Local User",
          };

          setSegments((prev) => [...prev, newSegment]);
          setPartialText("");

          const targets = targetLanguagesRef.current;
          if (!privacyMode && targets.length > 0) {
            analyzeText(
              finalTranscript.trim(),
              sourceLanguageRef.current,
              targets,
              expertModeRef.current
            ).then((analysis) => {
              if (analysis && analysis.translations) {
                const primary = targets[0];
                const tr = analysis.translations;
                const translated =
                  primary && tr[primary] !== undefined
                    ? tr[primary]
                    : (Object.values(tr)[0] as string | undefined) ?? "";
                setSegments((prev) =>
                  prev.map((seg) =>
                    seg.id === segmentId
                      ? {
                        ...seg,
                        translatedText: translated,
                        translatedLanguage: primary,
                        sentiment: analysis.sentiment,
                        sentimentEmoji: analysis.sentimentEmoji,
                        actionItems: analysis.actionItems,
                        summary: analysis.summary,
                      }
                      : seg
                  )
                );
              }
            });
          } else if (privacyModeRef.current) {
            // Local-only behavior: No external analysis
            setSegments((prev) =>
              prev.map((seg) =>
                seg.id === segmentId
                  ? { ...seg, summary: "Privacy Mode Active - No Cloud Summary" }
                  : seg
              )
            );
          }
          onSegmentComplete?.(newSegment);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== "aborted") {
          setError(`Recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        if (isRecording && streamRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Already active
          }
        }
      };

      recognition.start();
      mediaRecorderRef.current = recognition;
    } catch (err) {
      console.error("Failed to start recording:", err);
      setError(err instanceof Error ? err.message : "Failed to start recording");
      setIsConnecting(false);
    }
  }, [audioSettings, sourceLanguage, onSegmentComplete, onVolumePeak, setSegments]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) { }
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    setIsRecording(false);
    setIsConnected(false);
    setPartialText("");
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const clearSession = useCallback(() => {
    setSegments([]);
    setPartialText("");
    setError(null);
  }, []);

  return {
    isConnected,
    isConnecting,
    isRecording,
    partialText,
    error,
    toggleRecording,
    clearSession,
  };
};

function getLanguageCode(code: string): string {
  const langMap: Record<string, string> = {
    en: "en",
    hi: "hi-IN",
    te: "te-IN",
    ta: "ta-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    mr: "mr-IN",
    bn: "bn-IN",
    gu: "gu-IN",
    pa: "pa-IN",
    or: "or-IN",
    as: "as-IN",
  };
  return langMap[code] || code;
}