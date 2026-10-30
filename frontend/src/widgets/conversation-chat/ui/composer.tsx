"use client";

import { SendHorizontalIcon } from "lucide-react";
import { useId, useState, type FormEvent, type KeyboardEvent } from "react";

import { MESSAGE_MAX } from "@/entities/conversation";
import { Button } from "@/shared/ui/shadcn/button";
import { Textarea } from "@/shared/ui/shadcn/textarea";

type Props = {
  /** Why sending is unavailable right now, shown under the box; null when it is available. */
  unavailable: string | null;
  onSend: (body: string) => void;
};

const COUNTER_FROM = MESSAGE_MAX - 500;

const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Enter sends, Shift+Enter adds a line. Blank messages and over-long ones never leave the browser. */
export function Composer({ unavailable, onSend }: Props) {
  const [body, setBody] = useState("");
  const hintId = useId();
  const text = body.trim();
  const canSend = unavailable === null && text.length > 0 && body.length <= MESSAGE_MAX;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) return;
    onSend(text);
    setBody("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5 border-t p-3 sm:p-4">
      <div className="flex items-end gap-2">
        <label htmlFor={`${hintId}-input`} className="sr-only">
          Message
        </label>
        <Textarea
          id={`${hintId}-input`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MESSAGE_MAX}
          rows={2}
          placeholder="Write a message…"
          aria-describedby={hintId}
          className="max-h-40 min-h-11 resize-none"
        />
        <Button type="submit" size="icon-lg" disabled={!canSend} aria-label="Send message">
          <SendHorizontalIcon aria-hidden />
        </Button>
      </div>
      <p id={hintId} className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span role={unavailable ? "status" : undefined}>
          {unavailable ?? "Enter to send · Shift+Enter for a new line"}
        </span>
        {body.length >= COUNTER_FROM ? (
          <span className={body.length >= MESSAGE_MAX ? "text-destructive" : undefined}>
            {thousands(body.length)} / {thousands(MESSAGE_MAX)}
          </span>
        ) : null}
      </p>
    </form>
  );
}
