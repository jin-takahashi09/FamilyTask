"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: Array<{ 0?: { transcript?: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function detectSpeechRecognitionSupport(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

type VoiceInputButtonProps = {
  onResult: (text: string) => void;
  disabled?: boolean;
};

export function VoiceInputButton({
  onResult,
  disabled = false,
}: VoiceInputButtonProps) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(detectSpeechRecognitionSupport);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if (!supported) return;

    const win = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRecognitionCtor =
      win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: {
      results: Array<{ 0?: { transcript?: string } }>;
    }) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onResult(transcript);
      setListening(false);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
  }, [onResult, supported]);

  const toggle = () => {
    if (!recognitionRef.current || disabled) return;

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    setListening(true);
    recognitionRef.current.start();
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? "音声入力を停止" : "音声入力"}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
        listening
          ? "border-rose-300 bg-rose-50 text-rose-500"
          : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
      }`}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
