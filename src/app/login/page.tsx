import { Suspense } from "react";
import LoginPage from "./login-client";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-full bg-[#0b1f3a]" />}>
      <LoginPage />
    </Suspense>
  );
}
