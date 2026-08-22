/**
 * Lets list pages that render SectionSubNavCard via AdminListPageShell
 * suppress the Layout fallback nav (so detail pages still get tabs).
 *
 * Ownership is claimed synchronously during render so the first paint
 * does not flash a duplicate nav.
 */

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';

type Ctx = {
  owned: boolean;
  claim: () => void;
  release: () => void;
};

const SectionNavOwnedContext = createContext<Ctx | null>(null);

export function SectionNavOwnershipProvider({ children }: { children: ReactNode }) {
  const [owned, setOwned] = useState(false);
  const claim = () => setOwned(true);
  const release = () => setOwned(false);
  return (
    <SectionNavOwnedContext.Provider value={{ owned, claim, release }}>
      {children}
    </SectionNavOwnedContext.Provider>
  );
}

export function useSectionNavOwned(): boolean {
  return useContext(SectionNavOwnedContext)?.owned ?? false;
}

/** Call from AdminListPageShell so Layout skips its fallback SectionSubNavCard. */
export function useClaimSectionNav(): void {
  const ctx = useContext(SectionNavOwnedContext);
  // Claim as soon as the shell mounts (before paint) to avoid double-nav flash.
  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.claim();
    return () => ctx.release();
  }, [ctx]);
}
