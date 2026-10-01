import { RoleGate } from "@/components/RoleGate";
import { AppShell } from "@/components/AppShell";
import { VisitDetail } from "@/components/VisitDetail";

export default async function VisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RoleGate role="supervisor">
      <AppShell title="Validación de visita">
        <VisitDetail visitId={id} />
      </AppShell>
    </RoleGate>
  );
}
