"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";

interface CopyButtonProps {
  /** Absolute URL or relative path to copy. Relative paths are prefixed with window.location.origin. */
  text: string;
  label?: string;
}

export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const value = text.startsWith("/") ? `${window.location.origin}${text}` : text;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border/75 bg-card/90 px-2 py-1 text-xs font-medium transition-[background-color,border-color,color,transform] duration-150 hover:bg-muted/65 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}
