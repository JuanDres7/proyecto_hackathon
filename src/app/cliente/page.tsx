import { AppShell } from "@/components/AppShell";
import { CurrentServiceCard } from "@/components/client/CurrentServiceCard";
import { ClientChat } from "@/components/ClientChat";
import { RoleGate } from "@/components/RoleGate";

export default function ClientePage() {
  return (
    <RoleGate role="cliente">
      <AppShell title="Puro">
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <ClientChat />
          <CurrentServiceCard />
        </div>
      </AppShell>
    </RoleGate>
  );
}
