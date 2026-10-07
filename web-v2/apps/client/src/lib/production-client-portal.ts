/**
 * Legacy hostname gate for Client Portal UI hiding.
 * Disabled — Import, Export, and /apis are visible on all hosts including production.
 */
export function isProductionClientPortal(): boolean {
  return false;
}
