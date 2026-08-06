type LoginErrorLike = {
  code?: string;
  status?: number;
  message?: string;
  response?: { status?: number; data?: unknown };
};

function httpStatus(error: unknown): number | undefined {
  const err = error as LoginErrorLike;
  if (typeof err?.status === 'number') return err.status;
  if (typeof err?.response?.status === 'number') return err.response.status;
  return undefined;
}

/**
 * Login lockout was removed from the backend.
 * HTTP 429 here is almost always Cloudflare / edge rate limiting (e.g. error 1015),
 * not an application sign-in lock.
 */
export function getLoginErrorMessage(error: unknown, isArabic: boolean): string {
  const err = error as LoginErrorLike;
  const status = httpStatus(error);

  if (err?.code === 'TOO_MANY_REQUESTS' || status === 429) {
    return isArabic
      ? 'تم تقييد الطلبات مؤقتاً من الشبكة. يرجى الانتظار دقيقة ثم المحاولة مرة أخرى.'
      : 'Requests from this network were temporarily limited. Please wait about a minute and try again.';
  }

  if (error instanceof Error && error.message && !/^error code:\s*\d+/i.test(error.message)) {
    return error.message;
  }

  return isArabic ? 'فشل تسجيل الدخول.' : 'Login failed.';
}
