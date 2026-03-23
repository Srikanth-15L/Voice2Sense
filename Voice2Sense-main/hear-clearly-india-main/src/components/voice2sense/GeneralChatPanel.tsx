import React, { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Bot, User, Send, Mic, MicOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postHelpMessage } from "@/integrations/api/helpClient";
import { toast } from "sonner";
import { type ChatLine } from "@/types/voice2sense";

interface GeneralChatPanelProps {
  open: boolean;
  onClose: () => void;
  context?: Record<string, unknown>;
}

export const GeneralChatPanel = ({
  open,
  onClose,
  context = {},
}: GeneralChatPanelProps) => {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, loading]);

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => object }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => object }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition() as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: (() => void) | null;
      onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
    };
    recognition.continuous = false;
    recognition.interimResults = false;
    const src = context?.sourceLanguage === "hi" ? "hi-IN" : context?.sourceLanguage === "te" ? "te-IN" : "en";
    recognition.lang = src;

    recognition.onstart = () => {
      setIsListening(true);
      toast.info("Listening…");
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error !== "no-speech") {
        toast.error("Mic error: " + event.error);
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userLine: ChatLine = {
      id: Math.random().toString(36).slice(2, 10),
      role: "user",
      text: input.trim(),
      timestamp: new Date(),
    };

    setLines((prev) => [...prev, userLine]);
    setInput("");
    setLoading(true);

    try {
      const history = lines.slice(-10).map((l) => ({
        role: l.role,
        content: l.text,
      }));
      const answer = await postHelpMessage(
        userLine.text,
        history,
        context,
        "general"
      );

      const assistantLine: ChatLine = {
        id: Math.random().toString(36).slice(2, 10),
        role: "assistant",
        text: answer,
        timestamp: new Date(),
      };
      setLines((prev) => [...prev, assistantLine]);
    } catch {
      toast.error("Could not reach the assistant. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => setLines([]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md h-full flex flex-col p-0 border-l border-border bg-background text-foreground"
      >
        <SheetHeader className="p-4 border-b border-border bg-muted/40">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-base font-semibold">Voice2Sense assistant</span>
              <SheetDescription className="text-xs font-normal text-muted-foreground">
                General questions and how-to help
              </SheetDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground"
              onClick={handleClear}
            >
              Clear
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div
          className="flex-1 overflow-y-auto p-4 space-y-4"
          ref={scrollRef}
        >
          {lines.length === 0 && (
            <p className="text-sm text-muted-foreground text-center px-4 py-8">
              Ask about Voice2Sense, accessibility, captions, languages, or
              anything else. Use the phone button in the header for relay calls.
            </p>
          )}
          {lines.map((line) => (
            <div
              key={line.id}
              className={`flex gap-3 ${line.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  line.role === "user"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {line.role === "user" ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div
                className={`max-w-[82%] p-3 rounded-2xl text-sm shadow-sm ${
                  line.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted/80 border border-border rounded-tl-sm"
                }`}
              >
                <div className="whitespace-pre-wrap">{line.text}</div>
                <div className="text-[10px] mt-1.5 opacity-60">
                  {line.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs ml-11">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0.3s]" />
              </span>
              Thinking…
            </div>
          )}
        </div>

        <form
          onSubmit={handleSend}
          className="p-4 border-t border-border bg-card/50"
        >
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening ? "Listening…" : "Type a question…"
              }
              className="h-10"
              disabled={loading}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="shrink-0 h-10 w-10"
              onClick={toggleListening}
              disabled={loading}
            >
              {isListening ? (
                <MicOff className="w-4 h-4 text-destructive" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
            <Button
              type="submit"
              size="icon"
              className="shrink-0 h-10 w-10"
              disabled={loading || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};
