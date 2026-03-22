import { useEffect, useCallback, useRef } from "react";
import {
  collection,
  doc,
  setDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { getAuthInstance, getFirestoreInstance } from "@/integrations/firebase/app";
import { type TranscriptionSegment } from "@/types/voice2sense";

function getBroadcastClientId(): string {
  const uid = getAuthInstance().currentUser?.uid;
  if (uid) return uid;
  const key = "v2s_broadcast_client_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `anon-${crypto.randomUUID()}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

interface UseRealtimeOptions {
  roomId: string;
  onSegmentReceived: (segment: TranscriptionSegment) => void;
}

function segmentToFirestore(s: TranscriptionSegment) {
  return {
    id: s.id,
    text: s.text,
    speaker: s.speaker ?? null,
    language: s.language,
    timestamp:
      s.timestamp instanceof Date
        ? s.timestamp.toISOString()
        : String(s.timestamp),
    translatedText: s.translatedText ?? null,
    translatedLanguage: s.translatedLanguage ?? null,
    sentiment: s.sentiment ?? null,
    sentimentEmoji: s.sentimentEmoji ?? null,
    summary: s.summary ?? null,
    actionItems: s.actionItems ?? null,
  };
}

function deserializeSegment(data: Record<string, unknown>): TranscriptionSegment {
  const ts = data.timestamp as string;
  return {
    id: String(data.id),
    text: String(data.text ?? ""),
    speaker: data.speaker ? String(data.speaker) : undefined,
    language: String(data.language ?? ""),
    timestamp: new Date(ts),
    translatedText: data.translatedText
      ? String(data.translatedText)
      : undefined,
    translatedLanguage: data.translatedLanguage
      ? String(data.translatedLanguage)
      : undefined,
    sentiment: data.sentiment ? String(data.sentiment) : undefined,
    sentimentEmoji: data.sentimentEmoji
      ? String(data.sentimentEmoji)
      : undefined,
    summary: data.summary ? String(data.summary) : undefined,
    actionItems: Array.isArray(data.actionItems)
      ? (data.actionItems as string[])
      : undefined,
  };
}

export const useRealtime = ({
  roomId,
  onSegmentReceived,
}: UseRealtimeOptions) => {
  const onSegmentReceivedRef = useRef(onSegmentReceived);
  onSegmentReceivedRef.current = onSegmentReceived;

  useEffect(() => {
    const db = getFirestoreInstance();
    const segmentsRef = collection(db, "rooms", roomId, "segments");
    const q = query(segmentsRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const myId = getBroadcastClientId();
        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const data = change.doc.data() as Record<string, unknown>;
          const senderUid = String(data.senderUid ?? "");
          if (senderUid && senderUid === myId) return;
          onSegmentReceivedRef.current(deserializeSegment(data));
        });
      },
      (err) => console.error("Firestore room listener:", err)
    );

    return () => unsub();
  }, [roomId]);

  const broadcastSegment = useCallback(
    async (segment: TranscriptionSegment) => {
      const ref = doc(
        getFirestoreInstance(),
        "rooms",
        roomId,
        "segments",
        segment.id
      );
      try {
        await setDoc(ref, {
          ...segmentToFirestore(segment),
          senderUid: getBroadcastClientId(),
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.error("Firestore broadcast failed:", e);
      }
    },
    [roomId]
  );

  return { broadcastSegment };
};
