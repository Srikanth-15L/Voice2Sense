import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { getAuthInstance } from "@/integrations/firebase/app";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuthInstance(), (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

function FirebaseConfigMissing() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">
      <div className="max-w-lg space-y-4 text-center">
        <h1 className="text-xl font-semibold">Firebase configuration required</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The app needs Firebase web keys to run. In the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">hear-clearly-india-main</code>{" "}
          folder, copy <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env.example</code> to{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env</code> and set{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">VITE_FIREBASE_API_KEY</code> and{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">VITE_FIREBASE_PROJECT_ID</code>{" "}
          (Firebase Console → Project settings → Your apps → Web).
        </p>
        <p className="text-xs text-muted-foreground">
          Restart the dev server after saving <code className="rounded bg-muted px-1 py-0.5">.env</code>.
        </p>
      </div>
    </div>
  );
}

const App = () => {
  const hasFirebase =
    Boolean(import.meta.env.VITE_FIREBASE_API_KEY?.trim()) &&
    Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim());

  if (!hasFirebase) {
    return <FirebaseConfigMissing />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
