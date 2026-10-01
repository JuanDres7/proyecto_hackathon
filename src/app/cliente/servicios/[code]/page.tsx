import { AppShell } from "@/components/AppShell";
import { ClientServiceDetail } from "@/components/client/ClientServiceDetail";
import { RoleGate } from "@/components/RoleGate";

export default async function ClientServicePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <RoleGate role="cliente">
      <AppShell title="Detalle del servicio">
        <ClientServiceDetail code={code} />
      </AppShell>
    </RoleGate>
  );
}
