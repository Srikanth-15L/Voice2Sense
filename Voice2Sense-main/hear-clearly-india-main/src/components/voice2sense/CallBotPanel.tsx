import React, { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  PhoneForwarded,
  User,
  Bot,
  Send,
  Mic,
  MicOff,
  Volume2,
  PhoneOff,
  Signal,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postHelpMessage } from "@/integrations/api/helpClient";
import { postDialCall, postSpeakIntoCall } from "@/integrations/api/callAPI";
import { toast } from "sonner";
import { type ChatLine } from "@/types/voice2sense";

interface CallBotPanelProps {
  open: boolean;
  onClose: () => void;
  lines: ChatLine[];
  setLines: React.Dispatch<React.SetStateAction<ChatLine[]>>;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  context?: any;
}

export const CallBotPanel = ({
  open,
  onClose,
  lines,
  setLines,
  loading,
  setLoading,
  context
}: CallBotPanelProps) => {
  const [input, setInput] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isDialerOpen, setIsDialerOpen] = useState(true);
  const [activeSid, setActiveSid] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Real-time Transcript Listener (Phase 17.7)
  useEffect(() => {
    if (!activeSid || !open) return;

    let wsUrl: string;
    const apiUrl = import.meta.env.VITE_API_URL;

    if (apiUrl || window.location.hostname.includes('vercel.app')) {
      try {
        const url = new URL(apiUrl || "https://voice2sense.onrender.com");
        const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${wsProtocol}//${url.host}/api/call/stream`;
      } catch (e) {
        console.error("[ws-ui] Invalid API URL:", apiUrl);
        wsUrl = `wss://voice2sense.onrender.com/api/call/stream`;
      }
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'localhost:3001'
        : window.location.host;
      wsUrl = `${protocol}//${host}/api/call/stream`;
    }

    console.log(`[ws-ui] Connecting to transcript stream: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      try {
        socket.send(JSON.stringify({ role: "viewer" }));
      } catch (e) {
        console.warn("[ws-ui] viewer handshake failed:", e);
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "transcript") {
          console.log("[ws-ui] Transcript received:", data.text);
        }
        if (data.event === "transcript" && data.text) {
          setLines(prev => {
            // Find if there's an existing interim line to replace
            const lastLine = prev[prev.length - 1];
            if (lastLine?.id === 'caller-interim') {
              // Replace the last line
              const newLines = prev.slice(0, -1);
              return [...newLines, {
                id: data.isFinal ? `caller-${Date.now()}` : 'caller-interim',
                role: 'assistant',
                text: `${data.text}`,
                timestamp: new Date()
              }];
            } else {
              // Append new line
              return [...prev, {
                id: data.isFinal ? `caller-${Date.now()}` : 'caller-interim',
                role: 'assistant',
                text: `${data.text}`,
                timestamp: new Date()
              }];
            }
          });
        }
      } catch (err) {
        console.warn("[ws-ui] Error parsing message:", err);
      }
    };

    socket.onerror = (err) => console.error("[ws-ui] WebSocket error:", err);
    socket.onclose = () => console.log("[ws-ui] Transcription stream closed.");

    return () => socket.close();
  }, [activeSid, open]);

  // AUTO SCROLL TO BOTTOM
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Web Speech API for Mic Input (Phase 18)
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = context?.sourceLanguage === 'hi' ? 'hi-IN' : context?.sourceLanguage === 'te' ? 'te-IN' : 'en';

    recognition.onstart = () => {
      setIsListening(true);
      toast.info("Listening... Speak now!");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error !== "no-speech") {
        toast.error("Mic error: " + event.error);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Clear any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = context?.sourceLanguage || "en";
    utterance.lang = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en';

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userLine: ChatLine = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      text: input.trim(),
      timestamp: new Date()
    };

    setLines(prev => [...prev, userLine]);
    setInput("");
    setLoading(true);

    try {
      if (activeSid) {
        // PSTN RELAY MODE: Speak the user's typed text DIRECTLY into the phone
        setIsSpeaking(true);
        try {
          // Pass the selected language code to the backend TTS engine
          const langCode = context?.sourceLanguage === 'hi' ? 'hi-IN' : context?.sourceLanguage === 'te' ? 'te-IN' : 'en';
          await postSpeakIntoCall(activeSid, userLine.text); 
          setLines(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            role: 'assistant',
            text: `📞 Speaking: "${userLine.text}"`,
            timestamp: new Date()
          }]);
          toast.success("Your message was spoken into the call!");
        } catch (err) {
          console.error("PSTN Speak failed:", err);
          toast.error("Failed to speak into call. Call may have ended.");
        } finally {
          setIsSpeaking(false);
        }
      } else {
        // NORMAL CHAT MODE: Use AI chatbot
        const history = lines.slice(-6).map(l => ({ role: l.role, content: l.text }));
        const fullContext = { ...context, relayMode: true };

        const answer = await postHelpMessage(userLine.text, history, fullContext, "relay");

        const assistantLine: ChatLine = {
          id: Math.random().toString(36).substring(7),
          role: "assistant",
          text: answer,
          timestamp: new Date()
        };

        setLines(prev => [...prev, assistantLine]);
        speakText(answer);
      }
    } catch (err) {
      toast.error("Call Assistant failed to connect");
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md h-full flex flex-col p-0 border-l border-primary/20 bg-slate-950 text-white">
        <SheetHeader className="p-4 border-b border-white/10 bg-primary/10">
          <SheetTitle className="flex items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
              <PhoneForwarded className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold">Relay Call Assistant</span>
              <SheetDescription className="flex items-center gap-1 text-[10px] text-green-400">
                <Signal className="w-3 h-3" />
                Live Proxy Connection
              </SheetDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsDialerOpen(!isDialerOpen)} className="ml-auto text-white/50 hover:text-white">
              {isDialerOpen ? <MessageSquare className="w-4 h-4" /> : <PhoneForwarded className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white/50 hover:text-white">
              <PhoneOff className="w-4 h-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        {isDialerOpen ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900/50">
            <div className="w-full max-w-[280px] space-y-6">
              <div className="text-center space-y-2">
                <div className="text-3xl font-mono tracking-widest text-green-400 bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner min-h-[72px]">
                  {phoneNumber || "Dial Number"}
                </div>
                <p className="text-[12px] text-green-400 font-bold animate-pulse">Required Format: + [Country Code] [Number]</p>
                <p className="text-[10px] text-white/30">Example for India: +918340032723</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((key) => (
                  <Button
                    key={key}
                    variant="ghost"
                    className="h-14 w-14 rounded-full text-xl font-bold bg-white/5 hover:bg-white/10 text-white border border-white/5 active:scale-95 transition-transform"
                    onClick={() => setPhoneNumber(prev => prev + key)}
                  >
                    {key}
                  </Button>
                ))}
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl border-red-500/20 text-red-400 hover:bg-red-500/10"
                  onClick={() => setPhoneNumber("")}
                >
                  Clear
                </Button>
                <Button
                  className="flex-[2] h-14 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-bold shadow-lg shadow-green-500/20 gap-2"
                  onClick={async () => {
                    if (phoneNumber.length > 5) {
                      try {
                        toast.info(`Initiating PSTN call to ${phoneNumber}...`);
                        const langCode = context?.sourceLanguage === 'hi' ? 'hi-IN' : context?.sourceLanguage === 'te' ? 'te-IN' : 'en';
                        const dialRes = await postDialCall(phoneNumber);
                        setIsDialerOpen(false);
                        setActiveSid(dialRes.sid); // Save the SID for speaking later
                        setLines(prev => [...prev, {
                          id: dialRes.sid,
                          role: 'assistant',
                          text: `System: PSTN Call Connected. Dialing ${phoneNumber}...`,
                          timestamp: new Date()
                        }]);
                        // AUTO SWITCH TO CHAT VIEW
                        setIsDialerOpen(false);
                      } catch (err: any) {
                        toast.error(`Call failed: ${err.message}`);
                      }
                    } else {
                      toast.error("Please enter a valid phone number");
                    }
                  }}
                >
                  <PhoneForwarded className="w-5 h-5" />
                  Call Now
                </Button>
              </div>
            </div>

            <Button variant="link" className="mt-8 text-white/20 hover:text-white/40 text-[10px]" onClick={() => setIsDialerOpen(false)}>
              Skip to Direct Relay
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-950 to-slate-900" ref={scrollRef}>
            {lines.map((line) => (
              <div key={line.id} className={`flex gap-3 ${line.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative ${line.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-green-500/20 text-green-400'
                  }`}>
                  {line.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  {line.role === 'assistant' && isSpeaking && lines.indexOf(line) === lines.length - 1 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping" />
                  )}
                </div>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-xl ${line.role === 'user'
                    ? 'bg-slate-800 text-slate-100 rounded-tr-none'
                    : 'bg-green-900/40 border border-green-500/20 text-green-50 rounded-tl-none'
                  }`}>
                  {line.text}
                  <div className="text-[9px] mt-1 opacity-40">
                    {line.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {isSpeaking && (
              <div className="flex items-center gap-2 text-green-400 text-[10px] font-bold bg-green-950/40 p-2 rounded-lg border border-green-500/20 animate-pulse ml-11">
                <Volume2 className="w-3 h-3" />
                VOICE ACTIVE: AI is currently speaking your message aloud...
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-2 text-green-400/50 text-xs ml-11">
                <div className="flex gap-1">
                  <span className="w-1 h-1 bg-current rounded-full animate-bounce" />
                  <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
                Acting as Proxy...
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSend} className="p-4 bg-slate-900 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening..." : "What should the AI speak for you?"}
              className={`border-white/5 text-white h-10 rounded-xl transition-all ${isListening ? 'bg-red-500/10 placeholder:text-red-400 ring-1 ring-red-500/50' : 'bg-slate-800 placeholder:text-white/20'}`}
            />
            <Button
              type="button"
              size="icon"
              onClick={toggleListening}
              className={`h-10 w-10 shrink-0 rounded-xl transition-all ${isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse text-white' : 'bg-slate-800 hover:bg-slate-700 text-green-400 border border-white/5'}`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20" disabled={loading}>
              <Send className="w-4 h-4 text-white" />
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-white/30 px-1">
            <span>Press Enter to relay</span>
            <div className="flex items-center gap-2">
              <Volume2 className="w-3 h-3" />
              Auto-TTS Active
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};
