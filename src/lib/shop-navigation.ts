const shopHosts = new Set([
  "boucheriechezmima.com",
  "www.boucheriechezmima.com",
  "chez-mima-meat-market.lovable.app",
  "chezmima.lovable.app",
]);

/** Keep shop destinations in the current app, including links to older hosts. */
export function shopNavigationPath(destination: string, origin: string): string | null {
  try {
    const url = new URL(destination, origin);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.origin !== new URL(origin).origin && !shopHosts.has(url.hostname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}