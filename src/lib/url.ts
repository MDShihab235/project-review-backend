const CASE_INSENSITIVE_PATH_HOSTS = new Set(["github.com", "gitlab.com", "bitbucket.org"]);

/**
 * Canonical form of a URL used for duplicate detection:
 * https only, lowercase host without "www.", no query/hash, no trailing slash / ".git".
 * Repository paths on the big git hosts are case-insensitive, so they are lowercased too.
 */
export function normalizeUrl(raw: string): string {
  const u = new URL(raw.trim());
  const host = u.host.toLowerCase().replace(/^www\./, "");
  let path = u.pathname.replace(/\/+$/, "").replace(/\.git$/i, "");
  if (CASE_INSENSITIVE_PATH_HOSTS.has(host)) path = path.toLowerCase();
  return `https://${host}${path}`;
}
