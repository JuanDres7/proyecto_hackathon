import { RoleGate } from "@/components/RoleGate";
import { AppShell } from "@/components/AppShell";
import { CoordinatorDashboard } from "@/components/CoordinatorDashboard";
import { PqrQueue } from "@/components/PqrQueue";

export default function CoordinadorPage() {
  return (
    <RoleGate role="coordinador">
      <AppShell title="Panel del coordinador">
        <CoordinatorDashboard />
        <div className="mt-6">
          <PqrQueue />
        </div>
      </AppShell>
    </RoleGate>
  );
}
