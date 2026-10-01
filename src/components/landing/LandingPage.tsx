"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { AboutSection } from "./AboutSection";
import { ServicesSection } from "./ServicesSection";
import { ContactSection } from "./ContactSection";
import { LandingFooter } from "./LandingFooter";
import { LoginModal } from "./LoginModal";

function LandingContent() {
  const params = useSearchParams();
  const router = useRouter();
  const loginFromQuery = params.get("login") === "1";
  const [trackedQuery, setTrackedQuery] = useState(loginFromQuery);
  const [manualOpen, setManualOpen] = useState(false);
  const [queryDismissed, setQueryDismissed] = useState(false);

  if (loginFromQuery !== trackedQuery) {
    setTrackedQuery(loginFromQuery);
    setQueryDismissed(false);
    setManualOpen(false);
  }

  const loginOpen = manualOpen || (loginFromQuery && !queryDismissed);

  function openLogin() {
    setQueryDismissed(false);
    setManualOpen(true);
  }

  function closeLogin() {
    setManualOpen(false);
    setQueryDismissed(true);
    if (loginFromQuery) {
      router.replace("/");
    }
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface antialiased">
      <LandingNav onLogin={openLogin} />
      <main>
        <HeroSection onLogin={openLogin} />
        <AboutSection />
        <ServicesSection />
        <ContactSection />
      </main>
      <LandingFooter />
      <LoginModal open={loginOpen} onClose={closeLogin} />
    </div>
  );
}

export function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface text-white/70 flex items-center justify-center text-sm">
          Cargando LimpiApp…
        </div>
      }
    >
      <LandingContent />
    </Suspense>
  );
}
