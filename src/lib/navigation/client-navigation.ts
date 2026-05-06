type ClientRouterLike = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

function baseOrigin(origin?: string) {
  return origin ?? (typeof window !== "undefined" ? window.location.origin : "https://app.invalid");
}

export function normalizeAppHref(href: string, origin?: string): string | null {
  const raw = href.trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  try {
    const url = new URL(raw);
    if (url.origin !== baseOrigin(origin)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function pushAppHref(router: Pick<ClientRouterLike, "push">, href: string, origin?: string): boolean {
  const normalized = normalizeAppHref(href, origin);
  if (!normalized) return false;
  router.push(normalized);
  return true;
}

export function replaceAppHref(router: Pick<ClientRouterLike, "replace">, href: string, origin?: string): boolean {
  const normalized = normalizeAppHref(href, origin);
  if (!normalized) return false;
  router.replace(normalized);
  return true;
}

export function assignNavigableHref(
  href: string,
  assign: (href: string) => void = (nextHref) => window.location.assign(nextHref),
  origin?: string
): boolean {
  const raw = href.trim();
  if (!raw) return false;
  if (raw.startsWith("/")) {
    assign(raw);
    return true;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const currentOrigin = baseOrigin(origin);
    assign(url.origin === currentOrigin ? `${url.pathname}${url.search}${url.hash}` : url.toString());
    return true;
  } catch {
    return false;
  }
}