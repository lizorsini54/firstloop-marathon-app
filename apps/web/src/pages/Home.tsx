import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6">
      <div className="text-center">
        <h1 className="font-display text-5xl font-bold tracking-tight text-foreground">
          CADENZA
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Training, by the numbers
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SignedOut>
          <SignInButton mode="modal">
            <Button>Sign in</Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Button asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
          <UserButton />
        </SignedIn>
      </div>
    </main>
  );
}
