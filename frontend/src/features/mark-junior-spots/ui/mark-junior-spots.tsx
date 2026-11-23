"use client";

import { useId, useState } from "react";

import { juniorSpotsLine, type OpenSpot } from "@/entities/team";
import { underConstruction } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/shadcn/button";
import { Label } from "@/shared/ui/shadcn/label";
import { Switch } from "@/shared/ui/shadcn/switch";

type Props = { initial: OpenSpot[] };

/**
 * The Team Lead marks open spots as junior (NN-36, prototype). The switches
 * work on screen; saving says it's under construction and keeps nothing.
 */
export function MarkJuniorSpots({ initial }: Props) {
  const id = useId();
  const [spots, setSpots] = useState<OpenSpot[]>(initial);
  const [saved, setSaved] = useState(false);

  function toggle(number: number, junior: boolean) {
    setSpots((current) => current.map((s) => (s.number === number ? { ...s, type: junior ? "junior" : "standard" } : s)));
    setSaved(false);
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {spots.map((spot) => (
          <li key={spot.number} className="flex items-center justify-between gap-3">
            <Label htmlFor={`${id}-${spot.number}`} className="font-normal">
              Open spot {spot.number}: junior
            </Label>
            <Switch
              id={`${id}-${spot.number}`}
              checked={spot.type === "junior"}
              onCheckedChange={(checked) => toggle(spot.number, checked)}
            />
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground" aria-live="polite">
        {juniorSpotsLine(spots)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setSaved(true);
            underConstruction("Save junior spots");
          }}
        >
          Save junior spots
        </Button>
        {saved ? <span className="text-xs text-muted-foreground">Shown here only. Nothing was saved.</span> : null}
      </div>
    </div>
  );
}
