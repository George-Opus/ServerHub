// Vide par défaut = appels API en relatif (même origine, ex. via l'ingress `/api`).
// Définissez NEXT_PUBLIC_API_URL uniquement si l'API est sur une autre origine (dev, etc.).
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export type User = {
  id: number;
  email: string;
  username: string;
  created_at: string;
};

export type Server = {
  id: number;
  name: string;
  ip_address: string;
  provider: string;
  auth_type: "key" | "password";
  ssh_port: number;
  ssh_username: string;
  hostname: string | null;
  os_info: string | null;
  memory_total: string | null;
  disk_total: string | null;
  cpu_count: number | null;
  status: string;
  last_sync_at: string | null;
  notes: string | null;
  datacenter_id: number | null;
  rack_id: number | null;
  rack_u: number | null;
  rack_units: number;
  external_id: string | null;
  instance_type: string | null;
  ssh_key_profile_id: number | null;
  password_profile_id: number | null;
  has_ssh_key: boolean;
  created_at: string;
  updated_at: string;
};

export type Datacenter = {
  id: number;
  name: string;
  type: "cloud" | "custom";
  provider: string | null;
  location: string | null;
  description: string | null;
  cloud_connected: boolean;
  cloud_last_sync_at: string | null;
  cloud_sync_supported: boolean;
  created_at: string;
  updated_at: string;
};

export type CloudCredentialField = {
  key: string;
  label: string;
  type: string;
  placeholder?: string | null;
};

export type CloudConnection = {
  connected: boolean;
  provider: string | null;
  last_sync_at: string | null;
  sync_supported: boolean;
  credential_fields: CloudCredentialField[];
};

export type CloudInstancePreview = {
  external_id: string;
  name: string;
  ip_address: string;
  status: string;
  os_info: string | null;
  memory_total: string | null;
  disk_total: string | null;
  cpu_count: number | null;
  instance_type: string | null;
  already_imported: boolean;
};

export type CloudDiscoverResult = {
  instances: CloudInstancePreview[];
  total: number;
};

export type CloudSyncResult = {
  created: number;
  updated: number;
  total: number;
  message: string;
};

export type Rack = {
  id: number;
  datacenter_id: number;
  name: string;
  position: number;
  capacity_u: number;
  created_at: string;
};

export type RackWithServers = Rack & { servers: Server[] };

export type DatacenterInventory = Datacenter & {
  racks: RackWithServers[];
  servers: Server[];
};

export type Inventory = {
  datacenters: DatacenterInventory[];
  unassigned_servers: Server[];
};

export type ServerCreatePayload = {
  ip_address: string;
  provider: string;
  auth_type?: "key" | "password";
  ssh_port: number;
  ssh_username: string;
  ssh_private_key?: string;
  ssh_key_passphrase?: string;
  ssh_password?: string;
  ssh_key_profile_id?: number | null;
  password_profile_id?: number | null;
  notes?: string;
  datacenter_id?: number | null;
  rack_id?: number | null;
  rack_u?: number | null;
  rack_units?: number;
};

export type ServerUpdatePayload = {
  name?: string;
  ip_address?: string;
  provider?: string;
  auth_type?: "key" | "password";
  ssh_port?: number;
  ssh_username?: string;
  ssh_private_key?: string;
  ssh_key_passphrase?: string;
  ssh_password?: string;
  ssh_key_profile_id?: number | null;
  password_profile_id?: number | null;
  notes?: string;
  datacenter_id?: number | null;
  rack_id?: number | null;
  rack_u?: number | null;
  rack_units?: number;
};

export type SshKeyProfile = {
  id: number;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type PasswordProfile = {
  id: number;
  name: string;
  username: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type SshKeyProfileCreatePayload = {
  name: string;
  private_key: string;
  passphrase?: string;
  is_default?: boolean;
};

export type PasswordProfileCreatePayload = {
  name: string;
  username: string;
  password: string;
  is_default?: boolean;
};

export type RegistrationStatus = {
  enabled: boolean;
  bootstrap: boolean;
};

export type ServiceItem = {
  name: string;
  unit: string;
  active: string;
  sub: string;
  description: string;
  type: string | null;
  kind: string;
  config_kind: string | null;
  ports: number[];
};

export type ServiceScanResult = {
  services: ServiceItem[];
  total: number;
  scanned_at: string | null;
  scanned: boolean;
};

export type DockerContainer = {
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string;
};

export type ServiceDetail = {
  name: string;
  active: string;
  enabled: string;
  status: string;
  type: string | null;
  kind: string;
  config_kind: string;
  config: {
    summary?: Record<string, unknown>;
    files?: string[];
    raw?: string;
    editable_path?: string;
    test_cmd?: string;
    containers?: DockerContainer[];
  };
};

export type ServiceCatalogItem = {
  id: string;
  label: string;
  kind: string;
  description: string;
  check: string;
  install: string;
};

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
      if (Array.isArray(detail)) {
        detail = detail.map((d) => d.msg ?? JSON.stringify(d)).join(", ");
      }
    } catch {
      /* ignore */
    }
    throw new ApiError(String(detail), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  register: (email: string, username: string, password: string) =>
    request<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    }),

  login: async (username: string, password: string) => {
    const body = new URLSearchParams({ username, password });
    return request<{ access_token: string; token_type: string }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  },

  registrationStatus: () =>
    request<RegistrationStatus>("/api/auth/registration-status"),

  me: (token: string) => request<User>("/api/auth/me", {}, token),

  providers: (token: string) =>
    request<{ providers: string[] }>("/api/servers/providers", {}, token),

  listServers: (token: string) => request<Server[]>("/api/servers", {}, token),

  getServer: (token: string, id: number) => request<Server>(`/api/servers/${id}`, {}, token),

  createServer: (token: string, payload: ServerCreatePayload) =>
    request<Server>("/api/servers", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token),

  updateServer: (token: string, id: number, payload: ServerUpdatePayload) =>
    request<Server>(`/api/servers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, token),

  updateServerPlacement: (
    token: string,
    id: number,
    payload: {
      datacenter_id?: number | null;
      rack_id?: number | null;
      rack_u?: number | null;
      rack_units?: number;
    },
  ) =>
    request<Server>(`/api/servers/${id}/placement`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, token),

  deleteServer: (token: string, id: number) =>
    request<void>(`/api/servers/${id}`, { method: "DELETE" }, token),

  syncServer: (token: string, id: number) =>
    request<{ server: Server; message: string }>(`/api/servers/${id}/sync`, { method: "POST" }, token),

  getInventory: (token: string) =>
    request<Inventory>("/api/datacenters/inventory", {}, token),

  listDatacenters: (token: string) =>
    request<Datacenter[]>("/api/datacenters", {}, token),

  createDatacenter: (
    token: string,
    payload: { name: string; type: "cloud" | "custom"; provider?: string; location?: string; description?: string },
  ) =>
    request<Datacenter>("/api/datacenters", { method: "POST", body: JSON.stringify(payload) }, token),

  updateDatacenter: (token: string, id: number, payload: Partial<Datacenter>) =>
    request<Datacenter>(`/api/datacenters/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  deleteDatacenter: (token: string, id: number) =>
    request<void>(`/api/datacenters/${id}`, { method: "DELETE" }, token),

  createRack: (token: string, datacenterId: number, payload: { name: string; position?: number; capacity_u?: number }) =>
    request<Rack>(`/api/datacenters/${datacenterId}/racks`, { method: "POST", body: JSON.stringify(payload) }, token),

  updateRack: (token: string, datacenterId: number, rackId: number, payload: Partial<Rack>) =>
    request<Rack>(`/api/datacenters/${datacenterId}/racks/${rackId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, token),

  deleteRack: (token: string, datacenterId: number, rackId: number) =>
    request<void>(`/api/datacenters/${datacenterId}/racks/${rackId}`, { method: "DELETE" }, token),

  getCloudConnection: (token: string, datacenterId: number) =>
    request<CloudConnection>(`/api/datacenters/${datacenterId}/cloud/connection`, {}, token),

  setCloudConnection: (token: string, datacenterId: number, credentials: Record<string, string>) =>
    request<CloudConnection>(`/api/datacenters/${datacenterId}/cloud/connection`, {
      method: "PUT",
      body: JSON.stringify({ credentials }),
    }, token),

  deleteCloudConnection: (token: string, datacenterId: number) =>
    request<void>(`/api/datacenters/${datacenterId}/cloud/connection`, { method: "DELETE" }, token),

  discoverCloudInstances: (token: string, datacenterId: number) =>
    request<CloudDiscoverResult>(`/api/datacenters/${datacenterId}/cloud/discover`, {}, token),

  syncCloudInstances: (token: string, datacenterId: number) =>
    request<CloudSyncResult>(`/api/datacenters/${datacenterId}/cloud/sync`, { method: "POST" }, token),

  listSshKeyProfiles: (token: string) =>
    request<SshKeyProfile[]>("/api/credentials/ssh-keys", {}, token),

  createSshKeyProfile: (token: string, payload: SshKeyProfileCreatePayload) =>
    request<SshKeyProfile>("/api/credentials/ssh-keys", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token),

  updateSshKeyProfile: (
    token: string,
    id: number,
    payload: Partial<SshKeyProfileCreatePayload & { name: string }>,
  ) =>
    request<SshKeyProfile>(`/api/credentials/ssh-keys/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, token),

  setDefaultSshKeyProfile: (token: string, id: number) =>
    request<SshKeyProfile>(`/api/credentials/ssh-keys/${id}/default`, { method: "POST" }, token),

  deleteSshKeyProfile: (token: string, id: number) =>
    request<void>(`/api/credentials/ssh-keys/${id}`, { method: "DELETE" }, token),

  listPasswordProfiles: (token: string) =>
    request<PasswordProfile[]>("/api/credentials/passwords", {}, token),

  createPasswordProfile: (token: string, payload: PasswordProfileCreatePayload) =>
    request<PasswordProfile>("/api/credentials/passwords", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token),

  updatePasswordProfile: (
    token: string,
    id: number,
    payload: Partial<PasswordProfileCreatePayload & { name: string; username: string }>,
  ) =>
    request<PasswordProfile>(`/api/credentials/passwords/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, token),

  setDefaultPasswordProfile: (token: string, id: number) =>
    request<PasswordProfile>(`/api/credentials/passwords/${id}/default`, { method: "POST" }, token),

  deletePasswordProfile: (token: string, id: number) =>
    request<void>(`/api/credentials/passwords/${id}`, { method: "DELETE" }, token),

  netTool: (token: string, tool: "whois" | "dig" | "ping", target: string, record?: string) =>
    request<{ tool: string; target: string; command: string; output: string }>(
      "/api/tools/net",
      { method: "POST", body: JSON.stringify({ tool, target, record }) },
      token,
    ),

  listServices: (token: string, serverId: number) =>
    request<ServiceScanResult>(`/api/servers/${serverId}/services`, {}, token),

  scanServices: (token: string, serverId: number) =>
    request<ServiceScanResult>(`/api/servers/${serverId}/services/scan`, { method: "POST" }, token),

  getService: (token: string, serverId: number, name: string) =>
    request<ServiceDetail>(`/api/servers/${serverId}/services/${encodeURIComponent(name)}`, {}, token),

  dockerContainerAction: (
    token: string,
    serverId: number,
    container: string,
    action: "start" | "stop" | "restart",
  ) =>
    request<{ container: string; action: string; state: string; output: string }>(
      `/api/servers/${serverId}/services/docker/container`,
      { method: "POST", body: JSON.stringify({ container, action }) },
      token,
    ),

  serviceAction: (token: string, serverId: number, name: string, action: "start" | "stop" | "restart" | "reload") =>
    request<{ name: string; action: string; active: string; output: string }>(
      `/api/servers/${serverId}/services/${encodeURIComponent(name)}/action`,
      { method: "POST", body: JSON.stringify({ action }) },
      token,
    ),

  deployServiceConfig: (token: string, serverId: number, name: string, path: string, content: string) =>
    request<{ name: string; path: string; test_output: string; reload_output: string; active: string }>(
      `/api/servers/${serverId}/services/${encodeURIComponent(name)}/config`,
      { method: "POST", body: JSON.stringify({ path, content }) },
      token,
    ),

  serviceCatalog: (token: string) =>
    request<{ catalog: ServiceCatalogItem[] }>("/api/servers/service-catalog", {}, token),

  installService: (token: string, serverId: number, serviceId: string) =>
    request<{ id: string; already_installed: boolean; output: string }>(
      `/api/servers/${serverId}/services/install`,
      { method: "POST", body: JSON.stringify({ service_id: serviceId }) },
      token,
    ),

  terminalWsUrl: (serverId: number, token: string) => {
    if (typeof window !== "undefined") {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${window.location.host}/api/terminal/${serverId}?token=${encodeURIComponent(token)}`;
    }
    const wsBase = API_URL.replace(/^http/, "ws");
    return `${wsBase}/api/terminal/${serverId}?token=${encodeURIComponent(token)}`;
  },
};

export { ApiError, API_URL };
