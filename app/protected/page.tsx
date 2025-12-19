// app/protected/page.tsx
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ShellCharacterCreator } from "@/components/shell-character-creator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProtectedPage() {
  noStore(); // extra safety: tells Next this route is always request-time

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
