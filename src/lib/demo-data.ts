import { createFlow, encodeVisitFlow } from "@/components/supervisor/visit-flow";
import { memory } from "./memory-store";

function atDay(offset: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

export function ensureDemoShowcase() {
  const current = memory.orders.byNumber("#3089");
  const alreadySeeded =
    current?.email === "cliente@limpiapp.co" &&
    current.location === "Cra 7 #71-21, Bogotá" &&
    current.openingMessage === "Aseo de oficinas en la torre principal.";

  if (!alreadySeeded) {
    seedLauraServices();
  }
  seedCoordinatorOps();
}

function seedLauraServices() {
  const client = {
    email: "cliente@limpiapp.co",
    customerName: "Laura Méndez",
    customerDocument: "1020304050",
    phone: "3105550199",
  };
  const supervisorId = "demo-supervisor";
  const supervisorName = "Andrés Ríos";

  memory.orders.upsert({
    id: "demo-3089",
    draftId: "demo-3089",
    ...client,
    openingMessage: "Aseo de oficinas en la torre principal.",
    services: ["aseo_general"],
    scheduledAt: atDay(0, 8),
    location: "Cra 7 #71-21, Bogotá",
    accessNotes: "Portería torre B. Preguntar por recepción.",
    serviceNumber: "#3089",
    status: "confirmed",
    supervisorId,
    supervisorName,
  });
  memory.visits.upsert({
    id: "demo-visit-3089",
    client_uuid: "demo-visit-3089",
    supervisor_id: supervisorId,
    service_number: "#3089",
    site_name: "Cra 7 #71-21, Bogotá",
    contracted_activity: "Aseo general",
    status: "pendiente",
    created_at: atDay(0, 8),
    updated_at: atDay(0, 8),
  });

  memory.orders.upsert({
    id: "demo-3090",
    draftId: "demo-3090",
    ...client,
    openingMessage: "Mantenimiento de zonas verdes del conjunto.",
    services: ["jardineria"],
    scheduledAt: atDay(1, 9),
    location: "Calle 127 #45-10, Bogotá",
    accessNotes: "Parque central. El celador abre la reja lateral.",
    serviceNumber: "#3090",
    status: "confirmed",
    supervisorId,
    supervisorName,
  });
  memory.visits.upsert({
    id: "demo-visit-3090",
    client_uuid: "demo-visit-3090",
    supervisor_id: supervisorId,
    service_number: "#3090",
    site_name: "Calle 127 #45-10, Bogotá",
    contracted_activity: "Jardinería",
    status: "pendiente",
    created_at: atDay(1, 9),
    updated_at: atDay(1, 9),
  });

  const poolFlow = createFlow({
    serviceIds: ["limpieza_piscinas"],
    costCenter: "Laura Méndez",
    address: "Autopista Norte km 18, Bogotá",
    code: "#3091",
  });
  poolFlow.phase = 4;
  poolFlow.clientNotes = "El club pidió revisar el pH al cierre.";
  poolFlow.activities = poolFlow.activities.map((activity) => ({ ...activity, done: true }));

  memory.orders.upsert({
    id: "demo-3091",
    draftId: "demo-3091",
    ...client,
    openingMessage: "Limpieza semanal de la piscina del club.",
    services: ["limpieza_piscinas"],
    scheduledAt: atDay(-1, 7),
    location: "Autopista Norte km 18, Bogotá",
    accessNotes: "Ingreso por la portería de socios.",
    serviceNumber: "#3091",
    status: "confirmed",
    supervisorId,
    supervisorName,
  });
  memory.visits.upsert({
    id: "demo-visit-3091",
    client_uuid: "demo-visit-3091",
    supervisor_id: supervisorId,
    service_number: "#3091",
    site_name: "Autopista Norte km 18, Bogotá",
    contracted_activity: "Limpieza de piscinas",
    status: "completada",
    check_in_at: atDay(-1, 7),
    check_out_at: atDay(-1, 10),
    notes: encodeVisitFlow(poolFlow),
    created_at: atDay(-1, 7),
    updated_at: atDay(-1, 10),
  });

  const officeFlow = createFlow({
    serviceIds: ["aseo_general"],
    costCenter: "Laura Méndez",
    address: "Calle 53 #13-40, Bogotá",
    code: "#3066",
  });
  officeFlow.phase = 4;
  officeFlow.clientNotes = "Revisar baños del segundo piso.";
  officeFlow.activities = officeFlow.activities.map((activity) =>
    activity.id.endsWith(":banos")
      ? { ...activity, done: false, needsJustification: true, justification: "Faltó jabón en el piso 2." }
      : { ...activity, done: true },
  );

  memory.orders.upsert({
    id: "demo-3066",
    draftId: "demo-3066",
    ...client,
    openingMessage: "Aseo de la sede Chapinero.",
    services: ["aseo_general"],
    scheduledAt: atDay(-12, 8),
    location: "Calle 53 #13-40, Bogotá",
    accessNotes: "Recepción del piso 1.",
    serviceNumber: "#3066",
    status: "confirmed",
    supervisorId,
    supervisorName,
  });
  memory.visits.upsert({
    id: "demo-visit-3066",
    client_uuid: "demo-visit-3066",
    supervisor_id: supervisorId,
    service_number: "#3066",
    site_name: "Calle 53 #13-40, Bogotá",
    contracted_activity: "Aseo general",
    status: "novedad",
    check_in_at: atDay(-12, 8),
    check_out_at: atDay(-12, 11),
    novedad: "Faltó jabón en el baño del piso 2.",
    novedad_priority: "media",
    notes: encodeVisitFlow(officeFlow),
    created_at: atDay(-12, 8),
    updated_at: atDay(-12, 11),
  });

  memory.visits.upsert({
    id: "demo-visit-3050",
    client_uuid: "demo-visit-3050",
    supervisor_id: supervisorId,
    service_number: "#3050",
    site_name: "Cra 7 #71-21, Bogotá",
    contracted_activity: "Aseo general",
    status: "completada",
    check_in_at: atDay(-35, 8),
    check_out_at: atDay(-35, 12),
    created_at: atDay(-35, 8),
    updated_at: atDay(-35, 12),
  });
  memory.orders.upsert({
    id: "demo-3050",
    draftId: "demo-3050",
    ...client,
    openingMessage: "Aseo mensual de Torre Norte.",
    services: ["aseo_general"],
    scheduledAt: atDay(-35, 8),
    location: "Cra 7 #71-21, Bogotá",
    serviceNumber: "#3050",
    status: "confirmed",
    supervisorId,
    supervisorName,
  });

  if (!memory.alerts.all().some((alert) => alert.id === "demo-alert-3066")) {
    memory.alerts.add({
      id: "demo-alert-3066",
      visit_id: "demo-visit-3066",
      message: "Novedad en #3066: faltó jabón en el baño del piso 2. Prioridad media.",
      severity: "media",
      created_at: atDay(-12, 11),
    });
  }
  if (!memory.complaints.all().some((item) => item.id === "demo-complaint-3066")) {
    memory.complaints.add({
      id: "demo-complaint-3066",
      service_number: "#3066",
      body: "El baño del segundo piso quedó sin jabón.",
      rating: 2,
      label: "calidad",
      confidence: 86,
      summary: "Insumo faltante en baño del piso 2.",
      created_at: atDay(-11, 9),
    });
  }
  if (!memory.pqr.all().some((item) => item.id === "demo-pqr-3066")) {
    memory.pqr.add({
      id: "demo-pqr-3066",
      service_number: "#3066",
      priority: "media",
      status: "abierta",
      opened_at: atDay(-11, 9),
    });
  }

  const g = globalThis as { __limpiapp?: { seq: number } };
  if (g.__limpiapp && g.__limpiapp.seq < 3100) g.__limpiapp.seq = 3100;
}

function seedCoordinatorOps() {
  const andres = { id: "demo-supervisor", name: "Andrés Ríos" };
  const camila = { id: "demo-supervisor-2", name: "Camila Torres" };

  const garden = memory.orders.byNumber("#3090");
  if (garden) {
    memory.orders.upsert({ ...garden, supervisorId: andres.id, supervisorName: andres.name });
  }
  const gardenVisit = memory.visits.byNumber("#3090");
  if (gardenVisit) {
    memory.visits.upsert({
      ...gardenVisit,
      status: "en_curso",
      check_in_at: atDay(0, 9),
      check_in_lat: 4.711,
      check_in_lng: -74.072,
      updated_at: atDay(0, 9),
    });
  }

  const tower = memory.visits.byNumber("#3089");
  if (tower) {
    memory.visits.upsert({
      ...tower,
      check_in_lat: 4.655,
      check_in_lng: -74.055,
    });
  }

  memory.orders.upsert({
    id: "demo-3092",
    draftId: "demo-3092",
    email: "andino@limpiapp.co",
    customerName: "Centro Comercial Andino",
    customerDocument: "900123456",
    phone: "6015552200",
    openingMessage: "Aseo de zonas comunes del centro comercial.",
    services: ["aseo_general"],
    scheduledAt: atDay(0, 14),
    location: "Cra 11 #82-71, Bogotá",
    accessNotes: "Ingreso por bahía de carga, nivel -2.",
    serviceNumber: "#3092",
    status: "confirmed",
    supervisorId: camila.id,
    supervisorName: camila.name,
  });
  memory.visits.upsert({
    id: "demo-visit-3092",
    client_uuid: "demo-visit-3092",
    supervisor_id: camila.id,
    service_number: "#3092",
    site_name: "Cra 11 #82-71, Bogotá",
    contracted_activity: "Aseo general",
    status: "pendiente",
    check_in_lat: 4.667,
    check_in_lng: -74.053,
    created_at: atDay(0, 14),
    updated_at: atDay(0, 14),
  });

  memory.orders.upsert({
    id: "demo-3093",
    draftId: "demo-3093",
    email: "hospital@limpiapp.co",
    customerName: "Clínica del Country",
    customerDocument: "800987654",
    phone: "6015553388",
    openingMessage: "Jardinería del acceso principal y el patio interno.",
    services: ["jardineria"],
    scheduledAt: atDay(0, 7),
    location: "Cra 16 #82-57, Bogotá",
    accessNotes: "Reportarse en seguridad biomédica.",
    serviceNumber: "#3093",
    status: "confirmed",
    supervisorId: camila.id,
    supervisorName: camila.name,
    enRouteAt: atDay(0, 6),
  });
  memory.visits.upsert({
    id: "demo-visit-3093",
    client_uuid: "demo-visit-3093",
    supervisor_id: camila.id,
    service_number: "#3093",
    site_name: "Cra 16 #82-57, Bogotá",
    contracted_activity: "Jardinería",
    status: "en_curso",
    check_in_at: atDay(0, 7),
    check_in_lat: 4.668,
    check_in_lng: -74.057,
    created_at: atDay(0, 7),
    updated_at: atDay(0, 7),
  });

  if (!memory.alerts.all().some((alert) => alert.id === "demo-alert-3093")) {
    memory.alerts.add({
      id: "demo-alert-3093",
      visit_id: "demo-visit-3093",
      message: "Camila reportó retraso en #3093: el acceso biomédico tardó 25 minutos.",
      severity: "baja",
      status: "open",
      created_at: atDay(0, 7),
    });
  }

  const alert3066 = memory.alerts.all().find((alert) => alert.id === "demo-alert-3066");
  if (alert3066 && !alert3066.status) {
    alert3066.status = "open";
  }

  if (!memory.complaints.all().some((item) => item.id === "demo-complaint-3091")) {
    memory.complaints.add({
      id: "demo-complaint-3091",
      service_number: "#3091",
      body: "El agua de la piscina quedó con olor a cloro muy fuerte.",
      rating: 2,
      label: "calidad",
      confidence: 78,
      summary: "Queja por olor a cloro tras el cierre de #3091.",
      created_at: atDay(-1, 18),
    });
  }
  if (!memory.pqr.all().some((item) => item.id === "demo-pqr-3091")) {
    memory.pqr.add({
      id: "demo-pqr-3091",
      service_number: "#3091",
      priority: "alta",
      status: "abierta",
      opened_at: atDay(-1, 18),
    });
  }

  const g = globalThis as { __limpiapp?: { seq: number } };
  if (g.__limpiapp && g.__limpiapp.seq < 3100) g.__limpiapp.seq = 3100;
}
