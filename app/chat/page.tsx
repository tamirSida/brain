import { redirect } from "next/navigation";

import { ChatClient } from "./ChatClient";
import { currentEmail } from "@/lib/session";
import { readSession } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const email = await currentEmail();
  if (!email) redirect("/onboarding");

  const session = await readSession(email);
  if (!session) redirect("/onboarding");

  const firstName = session.profile.name.trim().split(/\s+/)[0];

  return <ChatClient firstName={firstName} />;
}
