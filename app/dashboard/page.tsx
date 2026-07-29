import Image from "next/image";
import { redirect } from "next/navigation";
import Link from "next/link";
import { faArrowRightFromBracket, faBolt, faCommentDots } from "@fortawesome/free-solid-svg-icons";

import { Agenda } from "@/components/Agenda";
import { Greeting } from "@/components/Greeting";
import { EditDashboard } from "@/components/EditDashboard";
import { QuickAsk } from "@/components/QuickAsk";
import { BrainGraph } from "@/components/BrainGraph";
import { SidePanel } from "@/components/SidePanel";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MetricCard } from "@/components/MetricCard";
import { currentEmail } from "@/lib/session";
import { readSession } from "@/lib/store";
import { connectors } from "@/lib/connectors";
import { getEvents } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const email = await currentEmail();
  if (!email) redirect("/onboarding");

  const session = await readSession(email);
  if (!session) redirect("/onboarding");

  const { profile, brief } = session;
  const firstName = profile.name.trim().split(/\s+/)[0];
  const liveCount = connectors.filter((c) => c.status === "live").length;

  return (
    <main className="relative min-h-dvh overflow-x-clip pb-40 lg:pb-16">
      <div className="horizon-wash" />

      <div className="relative mx-auto w-full max-w-[440px] px-4 pt-[max(1.75rem,env(safe-area-inset-top))] lg:max-w-[980px] lg:px-8">
        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/ofek-logo.svg" alt="אופק אחזקות" width={78} height={28} priority className="brand-mark opacity-90" />
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
            <Link
              href="/chat"
              className="flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-[12.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              <Icon icon={faCommentDots} className="text-[12px]" />
              שאל אותי
            </Link>
            <ThemeToggle />
            <form action={signOut}>
            <button
              type="submit"
              className="flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink-2"
            >
              <Icon icon={faArrowRightFromBracket} className="text-[10px]" />
              יציאה
            </button>
            </form>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
          <div className="min-w-0">
            {/* Lock screen head */}
            <section className="mt-10 sm:mt-12">
              <Greeting firstName={firstName} />
            </section>

            <QuickAsk />

            {/* Notifications */}
            <section className="mt-8" aria-label="המדדים שלך">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-medium text-ink-2">המדדים שלך</h2>
                <EditDashboard focus={profile.focus} />
              </div>
              <div className="space-y-3">
                {brief.metrics.map((m, i) => (
                  <MetricCard key={m.id ?? i} metric={m} index={i} />
                ))}
              </div>
            </section>

            {/* Briefing */}
            {brief.briefing && (
              <section
                className="rise notif mt-3 flex gap-3 p-4 sm:p-5"
                style={{ animationDelay: "290ms" }}
              >
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[8px] bg-brand/12 text-[12px] text-brand-hi">
                  <Icon icon={faBolt} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink-2">התמונה המלאה</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink">{brief.briefing}</p>
                </div>
              </section>
            )}
          </div>

          {/* Connectors + agenda — static column on desktop, sheet on mobile */}
          <aside className="lg:mt-10">
            <SidePanel>
              <div className="rise" style={{ animationDelay: "380ms" }}>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[14px] font-medium text-ink">המערכות המחוברות</h2>
                  <p className="text-[12px] text-ink-3">
                    <span className="num">{liveCount}</span>
                    {" מתוך "}
                    <span className="num">{connectors.length}</span>
                    {" פעילות"}
                  </p>
                </div>

                <div className="mt-4">
                  <BrainGraph connectors={connectors} />
                </div>

                <div className="mt-8">
                  <Agenda events={getEvents()} />
                </div>

                <p className="mt-6 text-center text-[12.5px] leading-relaxed text-ink-2">
                  המסך נבנה עבור <span className="bidi">{profile.title}</span> לפי מה שהגדרת.
                </p>
              </div>
            </SidePanel>
          </aside>
        </div>
      </div>
    </main>
  );
}

async function signOut() {
  "use server";
  const { clearCurrentEmail } = await import("@/lib/session");
  await clearCurrentEmail();
  redirect("/onboarding");
}
