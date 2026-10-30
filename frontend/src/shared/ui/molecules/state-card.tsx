import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Props = {
  icon?: ReactNode;
  title: string;
  message: ReactNode;
  /** The way forward: a link or button. Never leave someone at a dead end. */
  action?: ReactNode;
  /** The heading level; `h1` when this card is the whole screen. */
  as?: "h1" | "h2";
};

/** Not found, permission denied or empty: says what happened and offers the next step. */
export function StateCard({ icon, title, message, action, as: Heading = "h2" }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg [&_svg]:size-5 [&_svg]:text-muted-foreground">
          {icon}
          <Heading>{title}</Heading>
        </CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      {action ? <CardContent className="flex flex-wrap gap-2">{action}</CardContent> : null}
    </Card>
  );
}
