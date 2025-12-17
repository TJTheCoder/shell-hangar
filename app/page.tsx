import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, FileText, ShieldCheck, Wrench } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen w-full">
      {/* Ambient background */}
      <div className="hangar-bg pointer-events-none fixed inset-0 -z-10" />
      <div className="hangar-scanlines pointer-events-none fixed inset-0 -z-10" />

      <div className="mx-auto w-full max-w-6xl px-5">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-border/60">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="font-semibold tracking-wide text-foreground/90 hover:text-foreground"
            >
              SHELL HANGAR
            </Link>

            <div className="hidden items-center gap-2 md:flex">
              <span className="hangar-pill">SYSTEM: NOMINAL</span>
              <span className="hangar-pill">RULESET: CUSTOM</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense>
                <AuthButton />
              </Suspense>
            )}
            <ThemeSwitcher />
          </div>
        </header>

        {/* Content */}
        <section className="py-14">
          <div className="hangar-panel relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-40">
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-10 p-8 md:p-10">
              <div className="flex flex-col gap-4">
                <div className="text-xs tracking-[0.24em] text-muted-foreground">
                  PILOT OPERATIONS INTERFACE
                </div>

                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
                  Configure shells. Validate loadouts. Generate mission sheets.
                </h1>

                <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                  Shell Hangar is a COMP/CON-style builder for your table’s
                  custom ruleset—designed to keep builds consistent and easy to
                  share.
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={hasEnvVars ? "/protected" : "#"}
                  aria-disabled={!hasEnvVars}
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium",
                    "bg-primary text-primary-foreground shadow hover:bg-primary/90",
                    !hasEnvVars ? "pointer-events-none opacity-50" : "",
                  ].join(" ")}
                >
                  Enter Hangar Bay <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href={hasEnvVars ? "/auth/sign-up" : "#"}
                  aria-disabled={!hasEnvVars}
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium",
                    "border border-input bg-background/30 backdrop-blur hover:bg-accent hover:text-accent-foreground",
                    !hasEnvVars ? "pointer-events-none opacity-50" : "",
                  ].join(" ")}
                >
                  Create Pilot ID
                </Link>

                {!hasEnvVars && (
                  <p className="text-sm text-muted-foreground">
                    Hangar offline: Supabase env vars not detected.
                  </p>
                )}
              </div>

              {/* Spec strip */}
              <div className="grid gap-3 md:grid-cols-4">
                <div className="hangar-subpanel">
                  <div className="text-xs text-muted-foreground">STORAGE</div>
                  <div className="mt-1 font-medium">Supabase</div>
                </div>
                <div className="hangar-subpanel">
                  <div className="text-xs text-muted-foreground">VALIDATION</div>
                  <div className="mt-1 font-medium">Rules Engine</div>
                </div>
                <div className="hangar-subpanel">
                  <div className="text-xs text-muted-foreground">SHARING</div>
                  <div className="mt-1 font-medium">Links / Exports</div>
                </div>
                <div className="hangar-subpanel">
                  <div className="text-xs text-muted-foreground">OUTPUT</div>
                  <div className="mt-1 font-medium">Print Sheets</div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature tiles */}
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="hangar-panel p-6">
              <div className="flex items-center gap-3">
                <Wrench className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold">Shell Builder</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Assemble frames, modules, weapons, and systems with fast,
                readable constraints.
              </p>
            </div>

            <div className="hangar-panel p-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold">Integrity Checks</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Flag illegal combinations, missing requirements, and capacity
                issues before session night.
              </p>
            </div>

            <div className="hangar-panel p-6">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold">Mission Sheet Output</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Export a clean reference sheet for pilots and shells, ready for
                print or digital play.
              </p>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-border/60 py-10 text-xs text-muted-foreground md:flex-row md:items-center">
            <p>
              Shell Hangar is a tabletop utility. Configure it to match your
              campaign’s rules.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/auth/login" className="hover:text-foreground">
                Sign in
              </Link>
              <Link href="/auth/sign-up" className="hover:text-foreground">
                Create Pilot ID
              </Link>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
