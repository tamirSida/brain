import Image from "next/image";
import { redirect } from "next/navigation";

import { OnboardingForm } from "./OnboardingForm";
import { currentEmail } from "@/lib/session";
import { readSession } from "@/lib/store";

export default async function OnboardingPage() {
  const email = await currentEmail();
  if (email && (await readSession(email))) redirect("/dashboard");

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="horizon-wash" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pb-12 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <header className="rise">
          <Image
            src="/ofek-logo.svg"
            alt="אופק אחזקות"
            width={104}
            height={38}
            priority
            className="brand-mark opacity-95"
          />

          <h1 className="mt-9 text-[26px] leading-[1.25] font-light tracking-tight text-ink">
            מהלך חכם
            <br />
            מתחיל באופק
          </h1>

          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
            נתחיל בהיכרות קצרה. אשאל אותך מה חשוב לך לראות, ואבנה לך מסך בית
            שמרכז את זה מכל המערכות של הקבוצה.
          </p>
        </header>

        <div className="mt-10 flex-1">
          <OnboardingForm />
        </div>

        <p className="mt-10 text-center text-[12.5px] leading-relaxed text-ink-2">
          הנתונים נשמרים בענן של אופק בלבד ואינם משמשים לאימון מודלים.
        </p>
      </div>
    </main>
  );
}
