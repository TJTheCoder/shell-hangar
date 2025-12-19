import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShellCharacterCreator } from "@/components/shell-character-creator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProtectedPage() {
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
