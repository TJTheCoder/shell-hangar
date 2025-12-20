import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShellCharacterCreator } from "@/components/shell-character-creator";

function ProtectedFallback() {
  return <div className="p-6 text-sm text-muted-foreground">Loading shell…</div>;
}

async function ProtectedContent() {
  const supabase = await createClient();

  // Keep your existing auth gate + userId retrieval
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/auth/login");

  const userId = data.claims.sub;

  // Email gate (authoritative via getUser)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/auth/login");

  const allowedEmail = "drocasma9@gmail.com";
  if (user.email !== "drocasma9@gmail.com") {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
        {/* Background polish */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-red-500/20 via-fuchsia-500/15 to-indigo-500/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05),transparent_55%)]" />
        </div>

        {/* Card */}
        <div className="relative w-full max-w-2xl">
          <div className="rounded-2xl border bg-card/70 p-8 shadow-xl backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                Access Denied · Shell Hangar
              </div>

              <div className="text-xs text-muted-foreground">
                Signed in as <span className="font-medium">{user.email}</span>
              </div>
            </div>

            <div className="mt-6">
              <h1 className="text-3xl font-semibold tracking-tight">
                Nah, you actually thought I was going to let just anybody into the
                hangar. 💀
              </h1>

              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Come back when you pass the Shell Licensing Exam,
                lil&apos; zro. 😂
              </p>
            </div>

            {/* Faux “system status” */}
            <div className="mt-6 rounded-xl border bg-background/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">Hangar Security</div>
                <div className="text-sm text-muted-foreground">
                  Clearance: <span className="font-semibold text-red-500">REJECTED</span>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Skill level</span>
                  <span className="font-medium text-foreground">LOW</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shell license validation</span>
                  <span className="font-medium text-foreground">MISSING</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Recommended action</span>
                  <span className="font-medium text-foreground">Study harder</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
              >
                Go home
              </a>

              <a
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Sorry, let me deactivate my Disguise Self
              </a>
            </div>
          </div>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            Error code: <span className="font-mono">SHELL-403</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full">
      <ShellCharacterCreator userId={userId} />
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <Suspense fallback={<ProtectedFallback />}>
      <ProtectedContent />
    </Suspense>
  );
}
