import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/Brand";

import { OnboardingForm } from "./OnboardingForm";
import { currentEmail } from "@/lib/session";
import { readSession } from "@/lib/store";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ fresh?: string }>;
}) {
  // `?fresh=1` is the "start over" entry from the dashboard: an already
  // onboarded user deliberately rebuilding their board. Without it, an
  // onboarded user is bounced straight back to the dashboard.
  const { fresh } = await searchParams;
  const email = await currentEmail();
  if (!fresh && email && (await readSession(email))) redirect("/dashboard");

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="horizon-wash" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pb-12 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <header className="rise">
          <span className="group inline-flex text-ink">
            <BrandLogo className="h-10 w-auto" />
          </span>

          <h1 className="mt-9 text-[26px] leading-[1.25] font-light tracking-tight text-ink">
            A smarter move
            <br />
            starts at Lightstone
          </h1>

          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
            Let’s start with a short intake. I’ll ask what matters to you, then build
            a home screen that pulls it together from every system the firm runs on.
          </p>
        </header>

        <div className="mt-10 flex-1">
          <OnboardingForm />
        </div>

        <p className="mt-10 text-center text-[12.5px] leading-relaxed text-ink-2">
          Data stays in Lightstone’s own cloud and is never used to train models.
        </p>
      </div>
    </main>
  );
}
