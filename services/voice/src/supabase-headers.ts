export function buildSupabaseServiceHeaders(
  key: string,
  extraHeaders: Record<string, string> = {},
) {
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (!headers.Authorization && !isSupabasePlatformSecretKey(key)) {
    headers.Authorization = `Bearer ${key}`;
  }

  return headers;
}

function isSupabasePlatformSecretKey(key: string) {
  return key.startsWith("sb_secret_");
}
