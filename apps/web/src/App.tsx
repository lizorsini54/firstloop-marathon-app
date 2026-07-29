import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { setClerkTokenGetter } from "./lib/orpc";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import { Home } from "./pages/Home";
import { Intake } from "./pages/Intake";
import { LogSession } from "./pages/LogSession";

function ClerkTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setClerkTokenGetter(getToken);
  }, [getToken]);

  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  return (
    <>
      <SignedIn>
        <AppShell>{children}</AppShell>
      </SignedIn>
      <SignedOut>
        <Navigate to="/" replace />
      </SignedOut>
    </>
  );
}

export function App() {
  return (
    <>
      <ClerkTokenBridge />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/intake"
          element={
            <RequireAuth>
              <Intake />
            </RequireAuth>
          }
        />
        <Route
          path="/log"
          element={
            <RequireAuth>
              <LogSession />
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth>
              <History />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}
