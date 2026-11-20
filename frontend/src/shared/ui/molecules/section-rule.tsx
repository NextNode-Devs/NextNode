import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Shown after the heading, before the line (a status badge). */
  aside?: ReactNode;
  as?: "h3" | "h4";
  id?: string;
};

/** A small heading followed by a horizontal line: separates groups in a long list (by month, by milestone). */
export function SectionRule({ children, aside, as: Heading = "h3", id }: Props) {
  return (
    <div className="mt-5 mb-2 flex items-center gap-3">
      <Heading id={id} className="text-sm font-semibold">
        {children}
      </Heading>
      {aside}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
