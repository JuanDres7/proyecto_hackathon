import { Suspense } from "react";
import LoginPage from "./login-client";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface text-text-secondary text-sm">
          Cargando acceso…
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
