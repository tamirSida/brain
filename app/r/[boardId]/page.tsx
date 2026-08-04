import { notFound } from "next/navigation";

import { RemoteClient } from "./RemoteClient";
import { readBoard } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = { title: "אלמוגים · עריכה מהטלפון" };

/**
 * The phone remote, reached by scanning the QR on the dashboard.
 *
 * Deliberately unauthenticated: knowing the board id is the credential, and
 * the only way to learn it is to be in the room looking at the screen.
 */
export default async function RemotePage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const session = await readBoard(boardId);
  if (!session) notFound();

  return (
    <RemoteClient
      boardId={boardId}
      owner={session.profile.name}
      metrics={session.brief.metrics}
    />
  );
}
