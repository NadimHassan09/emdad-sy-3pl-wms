import { useUiPreferences } from '@emdad/core'

export type LocalizedMessage = [string, string]

/** Legacy task panels use tuple messages `[en, ar]`. */
export function useTaskT() {
  const { isArabic } = useUiPreferences()
  const t = (message: LocalizedMessage) => (isArabic ? message[1] : message[0])
  return { t, isArabic }
}

export function taskT(isArabic: boolean, en: string, ar: string) {
  return isArabic ? ar : en
}
