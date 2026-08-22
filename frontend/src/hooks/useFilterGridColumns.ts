import { useMediaQuery } from './useMediaQuery';

/** Matches `FILTER_GRID_CLASS`: 1 col mobile, 2 tablet, 4 desktop. */
export function useFilterGridColumns(): number {
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isSm = useMediaQuery('(min-width: 640px)');

  if (isLg) return 4;
  if (isSm) return 2;
  return 1;
}
