/**
 * Firebase Admin SDK (Firestore + Auth verification) using the service account.
 * Path: backend/config/firebase-service-account.json (gitignored)
 * or set FIREBASE_SERVICE_ACCOUNT_PATH to an absolute path.
 */
const path = require("path");
const admin = require("firebase-admin");

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, "firebase-service-account.json");

if (!admin.apps.length) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { admin, db };
