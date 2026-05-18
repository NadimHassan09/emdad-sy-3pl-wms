import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
  /** Optional id of an existing container; otherwise a `<div>` is appended to body. */
  containerId?: string;
}

/**
 * Portal — renders children into a top-level DOM node so overlays escape
 * stacking contexts. Lazy-creates `#ds-portal-root` on first use.
 */
export function Portal({ children, containerId }: PortalProps) {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const id = containerId ?? 'ds-portal-root';
    let node = document.getElementById(id);
    let created = false;
    if (!node) {
      node = document.createElement('div');
      node.id = id;
      document.body.appendChild(node);
      created = true;
    }
    setMountNode(node);
    return () => {
      if (created && node && node.childElementCount === 0) {
        node.remove();
      }
    };
  }, [containerId]);

  if (!mountNode) return null;
  return createPortal(children, mountNode);
}
