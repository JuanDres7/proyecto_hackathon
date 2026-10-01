const STORAGE_KEY = "limpiapp.current-service";
const PATCH_FLAG = "__limpiappServiceSnapshot";

export type ServiceSnapshot = {
  code: string;
  services: string[];
  when: string;
  location: string;
};

type OrderBody = {
  action?: string;
  draft?: {
    serviceNumber?: string;
    services?: string[];
    scheduledAt?: string;
    location?: string;
  };
};

export function readServiceSnapshot(): ServiceSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceSnapshot>;
    if (!parsed.code || typeof parsed.code !== "string") return null;
    return {
      code: parsed.code,
      services: Array.isArray(parsed.services) ? parsed.services.filter((item) => typeof item === "string") : [],
      when: typeof parsed.when === "string" ? parsed.when : "",
      location: typeof parsed.location === "string" ? parsed.location : "",
    };
  } catch {
    return null;
  }
}

function writeSnapshot(snapshot: ServiceSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new Event("limpiapp-service"));
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function captureOrder(input: RequestInfo | URL, init: RequestInit | undefined, response: Response) {
  const url = requestUrl(input);
  if (!url.includes("/api/orders") || !response.ok || typeof init?.body !== "string") return;
  const body = JSON.parse(init.body) as OrderBody;
  const json = (await response.clone().json()) as { ok?: boolean; serviceNumber?: string };
  if (!json.ok || !body.draft) return;

  if (body.action === "cancel") {
    const current = readServiceSnapshot();
    if (current && current.code === body.draft.serviceNumber) {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event("limpiapp-service"));
    }
    return;
  }

  if (body.action !== "confirm" || !json.serviceNumber) return;
  writeSnapshot({
    code: json.serviceNumber,
    services: body.draft.services ?? [],
    when: body.draft.scheduledAt ?? "",
    location: body.draft.location ?? "",
  });
}

export function installServiceSnapshot() {
  if (typeof window === "undefined") return;
  const host = window as Window & { [PATCH_FLAG]?: boolean };
  if (host[PATCH_FLAG]) return;
  host[PATCH_FLAG] = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await original(input, init);
    try {
      await captureOrder(input, init, response);
    } catch {
      // La tarjeta no debe interferir con el chat.
    }
    return response;
  };
}
