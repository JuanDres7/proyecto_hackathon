import { RoleGate } from "@/components/RoleGate";
import { AppShell } from "@/components/AppShell";
import { CoordinatorDashboard } from "@/components/CoordinatorDashboard";
import { PqrInsights } from "@/components/PqrInsights";

export default function CoordinadorPage() {
  return (
    <RoleGate role="coordinador">
      <AppShell title="Panel del coordinador">
        <CoordinatorDashboard />
        <PqrInsights />
      </AppShell>
    </RoleGate>
  );
}
