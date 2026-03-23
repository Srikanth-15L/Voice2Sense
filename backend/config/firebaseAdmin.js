/**
 * Firebase Admin SDK (Firestore + Auth verification) using the service account.
 * Path: backend/config/firebase-service-account.json (gitignored)
 * or set FIREBASE_SERVICE_ACCOUNT_PATH to an absolute path.
 */
const path = require("path");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  let serviceAccount;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
    }
  }

  if (!serviceAccount) {
    const serviceAccountPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.join(__dirname, "firebase-service-account.json");
    try {
      serviceAccount = require(serviceAccountPath);
    } catch (e) {
      console.error("Firebase Service Account file not found. Auth may fail.");
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
}

const db = admin.firestore();

module.exports = { admin, db };
