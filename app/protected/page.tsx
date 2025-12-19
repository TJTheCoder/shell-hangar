// app/protected/page.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShellCharacterCreator } from "@/components/shell-character-creator";

function ProtectedFallback() {
  return (
    <div className="p-6 text-sm text-muted-foreground">
      Loading shell…
    </div>
  );
}

async function ProtectedContent() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) redirect("/auth/login");

  const userId = data.claims.sub;
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
