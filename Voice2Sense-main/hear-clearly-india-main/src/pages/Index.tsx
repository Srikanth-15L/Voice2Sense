import { useState, useCallback, useEffect, useMemo } from "react"; 
import Header from "@/components/voice2sense/Header";
import StatsCards from "@/components/voice2sense/StatsCards";
import LanguageSelector from "@/components/voice2sense/LanguageSelector";
import CaptionDisplay from "@/components/voice2sense/CaptionDisplay";
import ActionControls from "@/components/voice2sense/ActionControls";
import ProductionInfo from "@/components/voice2sense/ProductionInfo";
import Footer from "@/components/voice2sense/Footer";
import SettingsPanel from "@/components/voice2sense/SettingsPanel";
import HistoryPanel, {
  type SessionRecord,
} from "@/components/voice2sense/HistoryPanel";
import { SignLanguageAvatar } from "@/components/voice2sense/SignLanguageAvatar";
import { useTranscription, analyzeText } from "@/hooks/useTranscription";
import { useRealtime } from "@/hooks/useRealtime";
import { toast } from "sonner";
import {
  type CaptionSettings,
  type AudioSettings,
  type TranscriptionSegment,
  type ChatLine,
  DEFAULT_CAPTION_SETTINGS,
  DEFAULT_AUDIO_SETTINGS,
} from "@/types/voice2sense";
import { CallBotPanel } from "@/components/voice2sense/CallBotPanel";
import { GeneralChatPanel } from "@/components/voice2sense/GeneralChatPanel";

const Index = () => {
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguages, setTargetLanguages] = useState<string[]>(["hi"]);
  const [expertMode, setExpertMode] = useState("Normal");
  const [showAvatar, setShowAvatar] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [roomId, setRoomId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || `room-${Math.random().toString(36).substring(2, 9)}`;
  });

  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>(DEFAULT_CAPTION_SETTINGS);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [generalChatOpen, setGeneralChatOpen] = useState(false);
  const [callRelayOpen, setCallRelayOpen] = useState(false);
  const [callRelayMode, setCallRelayMode] = useState<"chat" | "dialer">("dialer");
  const [relayLines, setRelayLines] = useState<ChatLine[]>([]);
  const [relayLoading, setRelayLoading] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [aiStatus, setAiStatus] = useState<"Idle" | "Connecting" | "Processing" | "Success" | "Error">("Idle");

  const handleSegmentReceived = useCallback((remoteSegment: TranscriptionSegment) => {
    setSegments((prev) => {
      if (prev.some(s => s.id === remoteSegment.id)) return prev;

      if (!privacyMode && targetLanguages.length > 0) {
        setAiStatus("Processing");
        analyzeText(remoteSegment.text, remoteSegment.language, targetLanguages, expertMode).then((analysis) => {
          if (analysis && analysis.translations) {
            setAiStatus("Success");
            const primary = targetLanguages[0];
            const tr = analysis.translations;
            const translated =
              primary && tr[primary] !== undefined
                ? tr[primary]
                : (Object.values(tr)[0] as string | undefined) ?? "";
            setSegments((current) =>
              current.map((s) =>
                s.id === remoteSegment.id
                  ? {
                      ...s,
                      translatedText: translated,
                      translatedLanguage: primary,
                      sentiment: analysis.sentiment,
                      sentimentEmoji: analysis.sentimentEmoji,
                      summary: analysis.summary,
                      actionItems: analysis.actionItems,
                    }
                  : s
              )
            );
          } else {
            setAiStatus("Error");
          }
        }).catch(() => setAiStatus("Error"));
      }

      return [...prev, remoteSegment];
    });
  }, [targetLanguages, expertMode, privacyMode]);

  const { broadcastSegment } = useRealtime({ roomId, onSegmentReceived: handleSegmentReceived });

  const {
    isConnecting,
    isRecording,
    partialText,
    error,
    toggleRecording,
  } = useTranscription({
    sourceLanguage,
    targetLanguages,
    setSegments,
    audioSettings,
    expertMode,
    privacyMode,
    onSegmentComplete: (segment) => {
      const enhancedSegment = { ...segment, speaker: "Local User" };
      if (!privacyMode) {
        broadcastSegment(enhancedSegment);
      }
    },
  });

  useEffect(() => {
    if (isRecording) {
      toggleRecording();
      setTimeout(() => {
        toggleRecording();
      }, 300);
    }
  }, [sourceLanguage]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      if (segments.length > 0 && sessionStartTime) {
        const session: SessionRecord = {
          id: `session-${Date.now()}`,
          startTime: sessionStartTime,
          endTime: new Date(),
          segments: [...segments],
        };
        setSessions((prev) => [session, ...prev]);
      }
    } else {
      setSessionStartTime(new Date());
      setSegments([]);
    }
    toggleRecording();
  }, [isRecording, toggleRecording, segments, sessionStartTime]);

  const handleTargetToggle = useCallback((code: string) => {
    setTargetLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }, []);

  const handleClearHistory = useCallback(() => {
    setSessions([]);
  }, []);

  const handleCopyRoomLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    navigator.clipboard.writeText(url.toString());
    toast.success("Room link copied!");
  };

  const avatarText = useMemo(() => {
    if (partialText?.trim()) return partialText;
    const last = segments[segments.length - 1];
    return last?.text ?? "";
  }, [partialText, segments]);

  const assistantContext = useMemo(
    () => ({
      sourceLanguage,
      targetLanguages,
      expertMode,
      roomId,
    }),
    [sourceLanguage, targetLanguages, expertMode, roomId]
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header
        sourceLanguage={sourceLanguage}
        onSourceChange={setSourceLanguage}
        onSettingsClick={() => setSettingsOpen(true)}
        onHistoryClick={() => setHistoryOpen(true)}
        onRelayClick={() => setCallRelayOpen(true)}
        onChatbotClick={() => setGeneralChatOpen(true)}
      />

      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <StatsCards
                segments={segments}
                sessionStartTime={sessionStartTime}
                isRecording={isRecording}
              />

              <div className="info-card">
                <div className="flex flex-col space-y-4 mb-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex flex-col">
                      <h3 className="text-lg font-semibold">Configuration</h3>
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground">
                        <span>Room ID: {roomId}</span>
                        <button onClick={handleCopyRoomLink} className="text-primary hover:underline">Copy Link</button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-4 border-r pr-4 border-border/50">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Privacy</span>
                          <button
                            onClick={() => setPrivacyMode(!privacyMode)}
                            className={`w-7 h-3.5 rounded-full relative transition-colors ${privacyMode ? 'bg-green-500' : 'bg-secondary'}`}
                          >
                            <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${privacyMode ? 'translate-x-3.5' : ''}`} />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Avatar</span>
                          <button
                            onClick={() => setShowAvatar(!showAvatar)}
                            className={`w-7 h-3.5 rounded-full relative transition-colors ${showAvatar ? 'bg-primary' : 'bg-secondary'}`}
                          >
                            <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${showAvatar ? 'translate-x-3.5' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide gap-2">
                    {['Normal', 'Medical', 'Legal', 'Education'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setExpertMode(mode)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
                          expertMode === mode
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/10">
                  <LanguageSelector
                    sourceLanguage={sourceLanguage}
                    targetLanguages={targetLanguages}
                    onSourceChange={setSourceLanguage}
                    onTargetToggle={handleTargetToggle}
                  />
                </div>
              </div>

              <CaptionDisplay
                segments={segments}
                partialText={partialText}
                settings={captionSettings}
                showTranslation={targetLanguages.length > 0}
              />
            </div>

            <div className="space-y-6">
              {showAvatar && (
                <SignLanguageAvatar text={avatarText} />
              )}

              <div className="info-card h-full">
                <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    AI Intelligence
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    aiStatus === 'Success' ? 'bg-green-500/20 text-green-500' :
                    aiStatus === 'Error' ? 'bg-red-500/20 text-red-500' :
                    'bg-secondary text-muted-foreground'
                  }`}>
                    {aiStatus}
                  </span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Live Summary</h4>
                    <p className="text-sm bg-secondary/30 p-3 rounded-lg border border-border/50 italic">
                      {segments.length > 0 && segments[segments.length - 1].summary
                        ? segments[segments.length - 1].summary
                        : "Waiting for conversation..."}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Action Items</h4>
                    <div className="space-y-2">
                      {segments.some(s => s.actionItems?.length) ? (
                        segments.flatMap(s => s.actionItems || []).slice(-5).map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm bg-green-500/10 p-2 rounded border border-green-500/20">
                            <span className="text-green-500 mt-1">✓</span>
                            <span>{item}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No tasks detected.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Mood (this line)</h4>
                    {segments.length > 0 && segments[segments.length - 1].sentiment ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className="text-4xl leading-none select-none"
                          title={segments[segments.length - 1].sentiment}
                          aria-hidden
                        >
                          {segments[segments.length - 1].sentimentEmoji ?? "💬"}
                        </span>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            segments[segments.length - 1].sentiment === "Negative"
                              ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                              : segments[segments.length - 1].sentiment === "Positive"
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : "bg-primary/20 text-primary"
                          }`}
                        >
                          {segments[segments.length - 1].sentiment}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Waiting for speech…</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ActionControls
            isRecording={isRecording}
            isConnecting={isConnecting}
            error={error}
            segments={segments}
            onToggleRecording={handleToggleRecording}
            onSettingsClick={() => setSettingsOpen(true)}
          />
          <ProductionInfo />
        </div>
      </main>

      <Footer />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        captionSettings={captionSettings}
        audioSettings={audioSettings}
        onCaptionSettingsChange={setCaptionSettings}
        onAudioSettingsChange={setAudioSettings}
      />

      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        sessions={sessions}
        onClearHistory={handleClearHistory}
      />

      <GeneralChatPanel
        open={generalChatOpen}
        onClose={() => setGeneralChatOpen(false)}
        context={assistantContext}
      />

      <CallBotPanel
        open={callRelayOpen}
        onClose={() => setCallRelayOpen(false)}
        lines={relayLines}
        setLines={setRelayLines}
        loading={relayLoading}
        setLoading={setRelayLoading}
        context={assistantContext}
      />
    </div>
  );
};

export default Index;