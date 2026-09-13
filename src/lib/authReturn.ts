/** Only allow a local destination, never another sign-in/onboarding loop. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/scan';
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith('//')) return '/scan';
    const url = new URL(decoded, 'https://return.invalid');
    if (url.origin !== 'https://return.invalid' || /^\/(auth|onboarding)(\/|$)/i.test(url.pathname)) return '/scan';
    return value;
  } catch {
    return '/scan';
  }
}

export function authStepPath(step: 'auth' | 'onboarding', returnTo: string): string {
  return `/${step}?${new URLSearchParams({ returnTo: safeReturnTo(returnTo) })}`;
}
