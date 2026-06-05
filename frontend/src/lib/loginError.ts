type LoginErrorLike = {
  code?: string;
  status?: number;
  message?: string;
};

export function getLoginErrorMessage(error: unknown, isArabic: boolean): string {
  const err = error as LoginErrorLike;
  if (err?.code === 'TOO_MANY_REQUESTS' || err?.status === 429) {
    return isArabic
      ? 'محاولات تسجيل دخول كثيرة. يرجى الانتظار دقيقة واحدة ثم المحاولة مرة أخرى.'
      : 'Too many sign-in attempts. Please wait about a minute and try again.';
  }
  if (error instanceof Error && error.message) return error.message;
  return isArabic ? 'فشل تسجيل الدخول.' : 'Login failed.';
}
