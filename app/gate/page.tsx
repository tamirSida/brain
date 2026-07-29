import { Suspense } from "react";

import { GateForm } from "./GateForm";

export const metadata = { title: "אופק · כניסה" };

/**
 * The door. Nothing behind it is reachable without the shared password, and
 * passing it grants no identity — onboarding still asks who you are.
 */
export default function GatePage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-x-clip px-4">
      <div className="horizon-wash" />
      <Suspense>
        <GateForm />
      </Suspense>
    </main>
  );
}
