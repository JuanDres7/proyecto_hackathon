import { RoleGate } from "@/components/RoleGate";
import { AppShell } from "@/components/AppShell";
import { SupervisorHome } from "@/components/SupervisorHome";

export default function SupervisorPage() {
  return (
    <RoleGate role="supervisor">
      <AppShell title="Módulo del supervisor">
        <SupervisorHome />
      </AppShell>
    </RoleGate>
  );
}
