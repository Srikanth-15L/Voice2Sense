import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  type Firestore 
} from "firebase/firestore";
import type { Analytics } from "firebase/analytics";

function getFirebaseConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;

  if (!apiKey || !projectId) {
    throw new Error(
      "Firebase web config missing. Set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in .env (see .env.example)."
    );
  }

  return {
    apiKey,
    authDomain: authDomain || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: storageBucket || `${projectId}.appspot.com`,
    messagingSenderId: messagingSenderId || "",
    appId: appId || "",
    ...(measurementId ? { measurementId } : {}),
  };
}

let appInstance: FirebaseApp | undefined;
let firestoreInstance: Firestore | undefined;
let analyticsInstance: Analytics | null = null;

/** Lazy init so missing .env does not crash the bundle before React can render a message. */
export function getFirebaseApp(): FirebaseApp {
  if (!appInstance) {
    appInstance = getApps().length ? getApp() : initializeApp(getFirebaseConfig());

    if (typeof window !== "undefined" && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
      void import("firebase/analytics").then(({ getAnalytics, isSupported }) => {
        void isSupported().then((supported) => {
          if (supported && appInstance) {
            analyticsInstance = getAnalytics(appInstance);
          }
        });
      });
    }
  }
  return appInstance;
}

/** Google Analytics (Firebase) — only after init in the browser. */
export function getAnalyticsInstance(): Analytics | null {
  return analyticsInstance;
}

export function getAuthInstance(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirestoreInstance(): Firestore {
  if (!firestoreInstance) {
    // We use initializeFirestore instead of getFirestore to force long-polling.
    // This fixes ERR_QUIC_PROTOCOL_ERROR which often happens on certain networks.
    firestoreInstance = initializeFirestore(getFirebaseApp(), {
      experimentalForceLongPolling: true,
    });
  }
  return firestoreInstance;
}
