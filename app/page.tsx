import { redirect } from "next/navigation";

import { currentEmail } from "@/lib/session";
import { readSession } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const email = await currentEmail();
  if (email && (await readSession(email))) redirect("/dashboard");
  redirect("/onboarding");
}
