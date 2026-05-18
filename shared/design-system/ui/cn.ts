/**
 * Minimal className combiner — replaces `clsx` without adding a dependency.
 *
 * Accepts strings, falsy values, or objects mapping classes → boolean.
 * Designed to stay tiny so primitives can use it everywhere without bloat.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, boolean | null | undefined>
  | ClassValue[];

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  const walk = (v: ClassValue): void => {
    if (!v && v !== 0) return;
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    if (typeof v === 'object') {
      for (const key of Object.keys(v)) {
        if (v[key]) out.push(key);
      }
    }
  };

  for (const v of values) walk(v);
  return out.join(' ');
}
