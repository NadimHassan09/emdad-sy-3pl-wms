import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export const INBOUND_WORKSPACE_SECTIONS = [
  'overview',
  'receiving',
  'putaway',
  'documents',
  'activity',
  'notes',
  'history',
] as const;

export const OUTBOUND_WORKSPACE_SECTIONS = [
  'overview',
  'pick',
  'pack',
  'dispatch',
  'documents',
  'activity',
  'notes',
  'history',
] as const;

export type InboundWorkspaceSection = (typeof INBOUND_WORKSPACE_SECTIONS)[number];
export type OutboundWorkspaceSection = (typeof OUTBOUND_WORKSPACE_SECTIONS)[number];

export function parseInboundWorkspaceSection(
  raw: string | null | undefined,
  fallback: InboundWorkspaceSection = 'overview',
): InboundWorkspaceSection {
  if (raw && (INBOUND_WORKSPACE_SECTIONS as readonly string[]).includes(raw)) {
    return raw as InboundWorkspaceSection;
  }
  return fallback;
}

export function parseOutboundWorkspaceSection(
  raw: string | null | undefined,
  fallback: OutboundWorkspaceSection = 'overview',
): OutboundWorkspaceSection {
  if (raw && (OUTBOUND_WORKSPACE_SECTIONS as readonly string[]).includes(raw)) {
    return raw as OutboundWorkspaceSection;
  }
  return fallback;
}

export function setOrderWorkspaceSection(
  searchParams: URLSearchParams,
  section: string,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.set('section', section);
  return next;
}

export function useInboundWorkspaceSection(defaultSection: InboundWorkspaceSection = 'overview') {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = useMemo(
    () => parseInboundWorkspaceSection(searchParams.get('section'), defaultSection),
    [searchParams, defaultSection],
  );

  const setSection = useCallback(
    (id: InboundWorkspaceSection) => {
      setSearchParams((prev) => setOrderWorkspaceSection(prev, id), { replace: true });
    },
    [setSearchParams],
  );

  return { activeSection, setSection };
}

export function useOutboundWorkspaceSection(defaultSection: OutboundWorkspaceSection = 'overview') {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = useMemo(
    () => parseOutboundWorkspaceSection(searchParams.get('section'), defaultSection),
    [searchParams, defaultSection],
  );

  const setSection = useCallback(
    (id: OutboundWorkspaceSection) => {
      setSearchParams((prev) => setOrderWorkspaceSection(prev, id), { replace: true });
    },
    [setSearchParams],
  );

  return { activeSection, setSection };
}
