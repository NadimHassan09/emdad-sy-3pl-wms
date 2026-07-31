import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
  /** Optional id of an existing container; otherwise a `<div>` is appended to body. */
  containerId?: string;
}

const DEFAULT_PORTAL_ID = 'ds-portal-root';

function resolveMountNode(containerId?: string): { node: HTMLElement; created: boolean } {
  const id = containerId ?? DEFAULT_PORTAL_ID;
  const existing = document.getElementById(id);
  if (existing instanceof HTMLElement) {
    return { node: existing, created: false };
  }
  const node = document.createElement('div');
  node.id = id;
  document.body.appendChild(node);
  return { node, created: true };
}

/**
 * Portal — renders children into a top-level DOM node so overlays escape
 * stacking contexts. Lazy-creates `#ds-portal-root` on first use.
 */
export function Portal({ children, containerId }: PortalProps) {
  const [{ node: mountNode, created }] = useState(() => {
    if (typeof document === 'undefined') {
      return { node: null as HTMLElement | null, created: false };
    }
    return resolveMountNode(containerId);
  });

  useEffect(() => {
    return () => {
      if (created && mountNode && mountNode.childElementCount === 0) {
        mountNode.remove();
      }
    };
  }, [created, mountNode]);

  if (!mountNode) return null;
  return createPortal(children, mountNode);
}
