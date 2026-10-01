"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { AboutSection } from "./AboutSection";
import { ServicesSection } from "./ServicesSection";
import { ContactSection } from "./ContactSection";
import { LandingFooter } from "./LandingFooter";
import { LoginModal } from "./LoginModal";

function LandingContent() {
  const [loginOpen, setLoginOpen] = useState(false);
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (params.get("login") === "1") {
      setLoginOpen(true);
    }
  }, [params]);

  function closeLogin() {
    setLoginOpen(false);
    if (params.get("login") === "1") {
      router.replace("/");
    }
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface antialiased">
      <LandingNav onLogin={() => setLoginOpen(true)} />
      <main>
        <HeroSection onLogin={() => setLoginOpen(true)} />
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
          Cargando LimpiAPP…
        </div>
      }
    >
      <LandingContent />
    </Suspense>
  );
}
