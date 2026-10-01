import { AppShell } from "@/components/AppShell";
import { ClientServices } from "@/components/client/ClientServices";
import { RoleGate } from "@/components/RoleGate";

export default function ClientServicesPage() {
  return (
    <RoleGate role="cliente">
      <AppShell title="Mis servicios">
        <ClientServices />
      </AppShell>
    </RoleGate>
  );
}
