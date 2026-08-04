import { redirect } from "next/navigation";

import { Agenda } from "@/components/Agenda";
import { BrandLogo } from "@/components/Brand";
import { Greeting } from "@/components/Greeting";
import { EditDashboard } from "@/components/EditDashboard";
import { QuickAsk } from "@/components/QuickAsk";
import { BrainGraph } from "@/components/BrainGraph";
import { SidePanel } from "@/components/SidePanel";
import { SignOut } from "@/components/SignOut";
import { ReonboardButton } from "@/components/ReonboardButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LiveMetrics } from "@/components/LiveMetrics";
import { QrPanel } from "@/components/QrPanel";
import { DEFAULT_LAYOUT } from "@/lib/layouts";
import { currentEmail } from "@/lib/session";
import { linkBoard, newBoardId, readSession, writeSession } from "@/lib/store";
import { connectors } from "@/lib/connectors";
import { getEvents } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const email = await currentEmail();
  if (!email) redirect("/onboarding");

  const session = await readSession(email);
  if (!session) redirect("/onboarding");

  // Sessions written before boards existed have no id; mint one on first view
  // rather than making the QR a feature only new users get.
  let boardId = session.boardId;
  if (!boardId) {
    boardId = newBoardId();
    await linkBoard(boardId, session.email);
    await writeSession({ ...session, boardId });
  } else {
    // The in-memory board map is empty after a dev reload, so re-assert the
    // link on every render — it is a cheap idempotent write.
    await linkBoard(boardId, session.email);
  }

  const { profile, brief } = session;
  const firstName = profile.name.trim().split(/\s+/)[0];
  const liveCount = connectors.filter((c) => c.status === "live").length;

  return (
    // Desktop is an app shell: the page itself never scrolls, each pane does.
    // Mobile keeps normal page scroll — there is far too much content for a
    // fixed viewport on a phone, and nested scroll areas there are miserable.
    <main className="relative flex min-h-dvh flex-col overflow-x-clip pb-40 lg:h-dvh lg:min-h-0 lg:overflow-hidden lg:pb-0">
      <div className="horizon-wash" />

      {/* Widths step up rather than stopping at one desktop size: on a large
          display or a wall screen the metric row should fill the glass. */}
      <div className="relative mx-auto flex w-full max-w-[440px] flex-col px-4 pt-[max(1.75rem,env(safe-area-inset-top))] lg:min-h-0 lg:flex-1 lg:max-w-[1120px] lg:px-8 xl:max-w-[1440px] 2xl:max-w-[1840px] 2xl:px-12">
        {/* Status bar */}
        <div className="flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="group inline-flex text-ink">
              <BrandLogo className="h-6 w-auto" />
            </span>
            {session.source === "demo" && (
              <span
                title="ANTHROPIC_API_KEY לא הוגדר — מוצגים נתוני דוגמה קבועים"
                className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[10.5px] font-medium text-warn"
              >
                נתוני הדגמה
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <QrPanel boardId={boardId} />
            <ThemeToggle />
            <ReonboardButton />
            <SignOut />
          </div>
        </div>

        {/* grid-rows minmax(0,1fr): without it the single row sizes to its
            content and overflows the shell instead of letting the panes scroll. */}
        <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 lg:pb-8 xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-10 2xl:grid-cols-[minmax(0,1fr)_520px] 2xl:gap-14">
          {/* Scrolls on its own if the cards outrun the viewport height. */}
          <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pe-1">
            {/* Lock screen head */}
            <section className="mt-10 sm:mt-12 lg:mt-6">
              <Greeting firstName={firstName} />
            </section>

            {/* Notifications */}
            <section className="mt-8" aria-label="המדדים שלך">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-medium text-ink-2">המדדים שלך</h2>
                <EditDashboard focus={profile.focus} layout={profile.layout ?? DEFAULT_LAYOUT} />
              </div>
              <LiveMetrics
                boardId={boardId}
                initial={brief.metrics}
                layout={profile.layout ?? DEFAULT_LAYOUT}
              />
            </section>

            {/* Below the metrics: read first, then ask. */}
            <QuickAsk />

          </div>

          {/* Connectors + agenda — static column on desktop, sheet on mobile */}
          <aside className="lg:mt-6 lg:flex lg:min-h-0 lg:flex-col">
            <SidePanel>
              <div
                className="rise lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
                style={{ animationDelay: "380ms" }}
              >
                <div className="flex shrink-0 items-baseline justify-between">
                  <h2 className="text-[14px] font-medium text-ink">המערכות המחוברות</h2>
                  <p className="text-[12px] text-ink-3">
                    <span className="num">{liveCount}</span>
                    {" מתוך "}
                    <span className="num">{connectors.length}</span>
                    {" פעילות"}
                  </p>
                </div>

                <div className="mt-4 shrink-0">
                  <BrainGraph connectors={connectors} />
                </div>

                {/* The agenda takes whatever height is left and scrolls inside
                    it, so the graph above it never gets pushed off screen.
                    Must be a flex column itself — as a plain block its child
                    would overflow the box instead of shrinking into it. */}
                <div className="mt-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                  <Agenda events={getEvents()} />
                </div>
              </div>
            </SidePanel>
          </aside>
        </div>
      </div>
    </main>
  );
}
