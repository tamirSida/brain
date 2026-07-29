import { Suspense } from "react";

import { LoginForm } from "./LoginForm";

export const metadata = { title: "אופק · כניסה" };

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-x-clip px-4">
      <div className="horizon-wash" />
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
