import { FlaskConicalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";

type Props = {
  title?: string;
  children?: ReactNode;
};

/**
 * The banner at the top of a Phase 2 prototype screen (NN-31): says plainly
 * that the data is sample data and that actions are not built yet.
 */
export function PrototypeNotice({
  title = "Prototype screen",
  children = "This screen shows sample data. Actions are under construction and save nothing.",
}: Props) {
  return (
    // Information, not an error: override the Alert's default role="alert".
    <Alert role="note">
      <FlaskConicalIcon aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
