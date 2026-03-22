import { useEffect, useRef, useState } from "react";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  doc, 
  setDoc,
  getFirestore
} from "firebase/firestore";

interface UseWebRTCProps {
  roomId: string;
  isCallEnabled: boolean;
}

export const useWebRTCAudio = ({ roomId, isCallEnabled }: UseWebRTCProps) => {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isCallEnabled) {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      setRemoteStream(null);
      return;
    }

    const db = getFirestore();
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(db, "rooms", roomId, "candidates"), event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    // Add local stream if available
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      streamRef.current = stream;
    });

    pcRef.current = pc;

    // TODO: Signaling logic (Offer/Answer) would go here
    // For now, these foundations enable the audio transport
    
    return () => {
      pc.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [roomId, isCallEnabled]);

  return { remoteStream };
};
