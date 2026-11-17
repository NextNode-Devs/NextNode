"use client";

import { cn } from "cn";
import { XIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required: every dialog is announced by its title. */
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons along the bottom (stacked on phones). */
  footer?: ReactNode;
  className?: string;
  /**
   * The element that opens the dialog (rendered through Radix's Trigger, so
   * focus returns to it on close). Omit it only when another control already
   * owns focus return.
   */
  trigger?: ReactNode;
};

/**
 * A modal dialog that fades and scales in over a dimmed backdrop (Phase 2
 * prototype kit, NN-31). Radix handles the accessibility: focus is trapped
 * inside, Esc or a click on the backdrop closes it, and focus returns to the
 * button that opened it. Motion only animates. Reduced motion: fade only.
 */
export function MotionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  trigger,
}: Props) {
  const reduceMotion = useReducedMotion();
  const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </DialogPrimitive.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
              <DialogPrimitive.Content
                asChild
                forceMount
                // Without a description Radix expects describedby to be opted out explicitly.
                {...(description ? {} : { "aria-describedby": undefined })}
              >
                <motion.div
                  className={cn(
                    "pointer-events-auto relative grid w-full max-w-md gap-4 rounded-xl border bg-background p-6 shadow-lg focus:outline-none",
                    className,
                  )}
                  initial={hidden}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={hidden}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                >
                  <div className="grid gap-1.5 pr-6">
                    <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
                    {description ? (
                      <DialogPrimitive.Description className="text-sm text-muted-foreground">
                        {description}
                      </DialogPrimitive.Description>
                    ) : null}
                  </div>
                  {children}
                  {footer ? (
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
                  ) : null}
                  <DialogPrimitive.Close
                    aria-label="Close"
                    className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <XIcon aria-hidden className="size-4" />
                  </DialogPrimitive.Close>
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
