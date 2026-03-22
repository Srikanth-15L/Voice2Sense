import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { getAuthInstance } from "@/integrations/firebase/app";

const googleProvider = new GoogleAuthProvider();

/** User-facing message for Firebase Auth errors (sign-in / sign-up / OAuth). */
export function mapSignInError(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Invalid email or password.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/email-already-in-use":
      return "This email is already registered. Sign in instead.";
    case "auth/weak-password":
      return "Password is too weak.";
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email. Sign in with email/password first, then link Google in account settings.";
    default:
      return err instanceof Error ? err.message : "Something went wrong.";
  }
}

export const authAPI = {
  /**
   * Creates the account, then signs out so the user must use Sign in to enter the app.
   */
  async signUp(email: string, password: string, name: string) {
    const cred = await createUserWithEmailAndPassword(
      getAuthInstance(),
      email,
      password
    );
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    await signOut(getAuthInstance());
    return { ok: true as const };
  },

  async signIn(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(getAuthInstance(), email, password);
    const token = await cred.user.getIdToken();
    return {
      token,
      user: cred.user,
    };
  },

  async signInWithGoogle() {
    await signInWithPopup(getAuthInstance(), googleProvider);
  },

  async logout() {
    await signOut(getAuthInstance());
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    return { ok: true };
  },

  async refreshToken() {
    const user = getAuthInstance().currentUser;
    if (!user) throw new Error("Not signed in");
    const token = await user.getIdToken(true);
    return { token };
  },

  async getMe(): Promise<{ user: User }> {
    const user = getAuthInstance().currentUser;
    if (!user) throw new Error("Not authenticated");
    return { user };
  },
};
