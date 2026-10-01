"use client";

import { useState } from "react";
import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { AboutSection } from "./AboutSection";
import { ServicesSection } from "./ServicesSection";
import { ContactSection } from "./ContactSection";
import { LandingFooter } from "./LandingFooter";
import { LoginModal } from "./LoginModal";

export function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false);

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
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
