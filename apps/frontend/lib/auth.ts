const LOCAL_ORIGIN = 'http://resume-matcher.local';

/** Allow only same-origin application paths as post-login destinations. */
export function safeReturnTo(value: string | undefined): string {
  if (!value) return '/dashboard';
  try {
    const destination = new URL(value, LOCAL_ORIGIN);
    if (
      destination.origin !== LOCAL_ORIGIN ||
      !value.startsWith('/') ||
      value.startsWith('//') ||
      destination.pathname === '/login'
    ) {
      return '/dashboard';
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return '/dashboard';
  }
}
