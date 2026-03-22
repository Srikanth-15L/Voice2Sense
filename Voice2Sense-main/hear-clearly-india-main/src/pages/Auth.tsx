import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { authAPI, mapSignInError } from "@/integrations/api/authAPI";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthInstance } from "@/integrations/firebase/app";
import "./Auth.css";

const Auth = () => {
  const [isRightPanelActive, setIsRightPanelActive] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuthInstance(), (user) => {
      if (user) navigate("/", { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.signUp(email, password, name);
      toast({
        title: "Account created",
        description: "Sign in with your email and password to continue.",
      });
      setName("");
      setPassword("");
      setIsRightPanelActive(false);
    } catch (error: unknown) {
      console.error("Sign up error:", error);
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: mapSignInError(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.signIn(email, password);
      toast({ title: "Signed in", description: "Welcome back." });
      navigate("/");
    } catch (error: unknown) {
      console.error("Sign in error:", error);
      toast({
        variant: "destructive",
        title: "Invalid credentials",
        description: mapSignInError(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await authAPI.signInWithGoogle();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Google sign-in failed",
        description: mapSignInError(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-body">
      <div className={`container ${isRightPanelActive ? "right-panel-active" : ""}`} id="container">
        <div className="form-container sign-up-container">
          <form onSubmit={handleSignUp}>
            <h1 className="font-bold m-0">Create Account</h1>
            <div className="social-container">
              <button
                type="button"
                className="social"
                onClick={() => void handleGoogleSignIn()}
                disabled={loading}
                title="Sign up with Google"
                aria-label="Sign up with Google"
              >
                <i className="fab fa-google"></i>
              </button>
            </div>
            <span className="text-xs">or use your email for registration</span>
            <input type="text" placeholder="Name" onChange={(e) => setName(e.target.value)} required />
            <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" disabled={loading}>{loading ? "Loading..." : "Sign Up"}</button>
          </form>
        </div>

        <div className="form-container sign-in-container">
          <form onSubmit={handleSignIn}>
            <h1 className="font-bold m-0">Sign in</h1>
            <div className="social-container">
              <button
                type="button"
                className="social"
                onClick={() => void handleGoogleSignIn()}
                disabled={loading}
                title="Sign in with Google"
                aria-label="Sign in with Google"
              >
                <i className="fab fa-google"></i>
              </button>
            </div>
            <span className="text-xs">or use your email and password</span>
            <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} required />
            <a href="#" className="text-sm my-4">Forgot your password?</a>
            <button type="submit" disabled={loading}>{loading ? "Loading..." : "Sign In"}</button>
          </form>
        </div>

        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <h1 className="font-bold m-0">Welcome Back!</h1>
              <p className="text-sm font-thin leading-5 tracking-wide my-5">To keep connected with us please login with your personal info</p>
              <button className="ghost" onClick={() => setIsRightPanelActive(false)}>Sign In</button>
            </div>
            <div className="overlay-panel overlay-right">
              <h1 className="font-bold m-0">Hello, Friend!</h1>
              <p className="text-sm font-thin leading-5 tracking-wide my-5">Enter your personal details and start journey with us</p>
              <button className="ghost" onClick={() => setIsRightPanelActive(true)}>Sign Up</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
