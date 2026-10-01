import type { QuoteDraft } from "./types";

type MemoryOrder = QuoteDraft & {
  id: string;
  cancellationReason?: string;
  supervisorId?: string;
  supervisorName?: string;
  enRouteAt?: string;
  quoteJson?: Record<string, unknown>;
};

type MemoryVisit = {
  id: string;
  client_uuid: string;
  supervisor_id?: string | null;
  service_number?: string | null;
  site_name: string;
  contracted_activity: string;
  status: string;
  check_in_at?: string | null;
  check_out_at?: string | null;
  check_in_lat?: number | null;
  check_in_lng?: number | null;
  check_out_lat?: number | null;
  check_out_lng?: number | null;
  novedad?: string | null;
  notes?: string | null;
  novedad_priority?: string | null;
  created_at: string;
  updated_at: string;
};

type MemoryComplaint = {
  id: string;
  service_number: string;
  body: string;
  rating: number;
  photo_path?: string | null;
  label?: string | null;
  confidence?: number | null;
  vision_valid?: boolean | null;
  vision_note?: string | null;
  summary?: string | null;
  nlp_json?: Record<string, unknown> | null;
  created_at: string;
};

type MemoryPqr = {
  id: string;
  service_number: string;
  priority: string;
  status: string;
  opened_at: string;
};

type MemoryAlert = {
  id: string;
  visit_id: string;
  message: string;
  severity: string;
  created_at: string;
};

type G = typeof globalThis & {
  __limpiapp?: {
    seq: number;
    orders: MemoryOrder[];
    visits: MemoryVisit[];
    complaints: MemoryComplaint[];
    pqr: MemoryPqr[];
    alerts: MemoryAlert[];
  };
};

function store() {
  const g = globalThis as G;
  if (!g.__limpiapp) {
    g.__limpiapp = {
      seq: 3000,
      orders: [],
      visits: [],
      complaints: [],
      pqr: [],
      alerts: [],
    };
  }
  return g.__limpiapp;
}

export const memory = {
  nextCode() {
    const s = store();
    const n = s.seq;
    s.seq += 1;
    return `#${n}`;
  },
  orders: {
    all: () => store().orders,
    upsert(order: MemoryOrder) {
      const s = store();
      const i = s.orders.findIndex((o) => o.id === order.id || o.draftId === order.draftId);
      if (i >= 0) s.orders[i] = { ...s.orders[i], ...order };
      else s.orders.push(order);
      return s.orders.find((o) => o.id === order.id)!;
    },
    byDraft(draftId: string) {
      return store().orders.find((o) => o.draftId === draftId || o.id === draftId);
    },
    byNumber(serviceNumber: string) {
      return store().orders.find((o) => o.serviceNumber === serviceNumber);
    },
    confirmed() {
      return store().orders.filter((o) => o.status === "confirmed");
    },
  },
  visits: {
    all: () => store().visits,
    byNumber(serviceNumber: string): MemoryVisit | null {
      const rows = store().visits.filter((v) => v.service_number === serviceNumber);
      return rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
    },
    upsert(row: MemoryVisit) {
      const s = store();
      const i = s.visits.findIndex((v) => v.client_uuid === row.client_uuid);
      if (i >= 0) s.visits[i] = { ...s.visits[i], ...row };
      else s.visits.push(row);
    },
  },
  complaints: {
    byNumber(n: string) {
      return store().complaints.find((c) => c.service_number === n);
    },
    add(c: MemoryComplaint) {
      store().complaints.push(c);
    },
    all: () => store().complaints,
  },
  pqr: {
    byNumber(n: string) {
      return store().pqr.find((p) => p.service_number === n);
    },
    add(p: MemoryPqr) {
      store().pqr.push(p);
    },
    all: () => store().pqr,
  },
  alerts: {
    add(a: MemoryAlert) {
      store().alerts.push(a);
    },
    all: () => store().alerts,
  },
};
