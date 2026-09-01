import { cn } from "@/lib/cn";

export function WalletMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-primary" />
      <path d="M8 11.5h16v11a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="#fffdf7" />
      <path d="M8 11.5 16 8l8 3.5" fill="none" stroke="#fffdf7" strokeWidth="1.6" />
      <path d="M12 17h8M12 20.5h5" stroke="#1a4d44" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
