import { RoleGate } from "@/components/RoleGate";
import { AppShell } from "@/components/AppShell";
import { CoordinatorDashboard } from "@/components/CoordinatorDashboard";

export default function CoordinadorPage() {
  return (
    <RoleGate role="coordinador">
      <AppShell title="Panel del coordinador">
        <CoordinatorDashboard />
      </AppShell>
    </RoleGate>
  );
}
