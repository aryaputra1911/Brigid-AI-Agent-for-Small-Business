// The host names the proxy answers to. A Host header is chosen by whoever sends the request, so
// it is compared with this list, and the Origin is compared with it too.
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);
const DEPLOY_HOST_ENV_KEYS = [
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_BRANCH_URL",
] as const;

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function allowedHostnames(
  env: Record<string, string | undefined>,
): Set<string> {
  const allowed = new Set(LOCAL_HOSTNAMES);
  for (const key of DEPLOY_HOST_ENV_KEYS) {
    const raw = env[key]?.trim();
    if (raw) {
      const parsed = hostnameOf(raw.includes("://") ? raw : `https://${raw}`);
      if (parsed) allowed.add(parsed);
    }
  }
  const extra = env.BRIGID_ALLOWED_HOSTS?.split(",") ?? [];
  for (const item of extra) {
    const trimmed = item.trim();
    if (trimmed) {
      const parsed = hostnameOf(
        trimmed.includes("://") ? trimmed : `https://${trimmed}`,
      );
      if (parsed) allowed.add(parsed);
    }
  }
  return allowed;
}

export function isLocalRequest(
  host: string | null,
  origin: string | null,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const hostname = host === null ? null : hostnameOf(`http://${host}`);
  if (hostname === null) return false;
  const allowed = allowedHostnames(env);
  if (!allowed.has(hostname)) return false;
  if (origin === null) return true;
  const originHostname = hostnameOf(origin);
  if (originHostname === null) return false;
  if (originHostname === hostname) return true;
  return LOCAL_HOSTNAMES.has(hostname) && LOCAL_HOSTNAMES.has(originHostname);
}
