import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SafeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
  describedBy?: string;
};

export function SafeDialog({
  open,
  onOpenChange,
  children,
  className,
  labelledBy,
  describedBy,
}: SafeDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => panelRef.current?.focus());

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/70"
        onMouseDown={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cn(
          "relative z-10 grid w-full max-w-lg gap-4 rounded-lg border border-border bg-background p-6 shadow-lg outline-none",
          className,
        )}
      >
        {children}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3"
          aria-label="Закрыть"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>,
    document.body,
  );
}