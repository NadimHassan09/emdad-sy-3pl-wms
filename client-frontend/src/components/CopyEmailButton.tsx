import { useState, type ReactElement, type ReactNode } from 'react';

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for older browsers.
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function CopyEmailButton({
  copyText: textToCopy,
  copiedLabel,
  className,
  children,
}: {
  copyText: string;
  copiedLabel?: string;
  className?: string;
  children: ReactNode;
}): ReactElement {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await copyText(textToCopy);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // If clipboard fails, do nothing (user can still manually copy from the UI).
        }
      }}
    >
      {copied ? copiedLabel ?? 'Copied' : children}
    </button>
  );
}

