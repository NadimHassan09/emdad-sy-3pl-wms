import { toast } from 'sonner'

/** Drop-in for legacy `useToast()` panels. */
export function useToast() {
  return {
    success: (msg: string) => toast.success(msg),
    error: (msg: string) => toast.error(msg),
    info: (msg: string) => toast.info(msg),
  }
}
