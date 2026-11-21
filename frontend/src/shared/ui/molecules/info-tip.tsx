"use client";

import { InfoIcon } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/shadcn/popover";

type Props = {
  /**
   * The button's accessible name, e.g. "Explain the new talent filter". Don't
   * repeat the control's own label word for word, or a search by that label
   * finds both.
   */
  label: string;
  children: React.ReactNode;
};

/**
 * A small (i) button that explains the control beside it. A mouse opens it on
 * hover; a tap, click, Enter or Space opens it too and keeps it open until
 * Escape or a click elsewhere. Works on touch screens, unlike a tooltip.
 */
export function InfoTip({ label, children }: Props) {
  const [open, setOpen] = useState(false);
  // Opened by the mouse resting on it: leaving closes it again, a click keeps it open.
  const byHover = useRef(false);

  const isMouse = (event: PointerEvent) => event.pointerType === "mouse";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) byHover.current = false;
        setOpen(next);
      }}
    >
      <PopoverTrigger
        type="button"
        aria-label={label}
        className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none after:absolute after:-inset-2.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onPointerEnter={(event) => {
          if (!isMouse(event) || open) return;
          byHover.current = true;
          setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (!isMouse(event) || !byHover.current) return;
          byHover.current = false;
          setOpen(false);
        }}
        onClick={(event) => {
          if (!byHover.current) return;
          // Already open from hovering: the click pins it rather than closing it.
          event.preventDefault();
          byHover.current = false;
        }}
      >
        <InfoIcon className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 text-sm" onOpenAutoFocus={(event) => event.preventDefault()}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
