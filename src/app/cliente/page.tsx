import { AppShell } from "@/components/AppShell";
import { ClientChat } from "@/components/ClientChat";

export default function ClientePage() {
  return (
    <AppShell title="Atención al cliente (IA)">
      <ClientChat />
    </AppShell>
  );
}
