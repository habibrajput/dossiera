import { headers } from 'next/headers';

/** Forward the browser's session cookie on server-side print-page API requests. */
export async function getBackendRequestHeaders(): Promise<Record<string, string>> {
  const cookie = (await headers()).get('cookie');
  return cookie ? { cookie } : {};
}
