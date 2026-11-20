"use client";

import { useId, useState, type FormEvent } from "react";

import { PROJECT_UPDATE_LIMITS } from "@/entities/project-update";
import { underConstruction } from "@/shared/lib/toast";
import { FormField } from "@/shared/ui/molecules/form-field";
import { Button } from "@/shared/ui/shadcn/button";
import { Textarea } from "@/shared/ui/shadcn/textarea";

/** "Post an update" (prototype, #92): checks the text, then says posting is under construction. */
export function PostUpdateForm() {
  const id = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | undefined>();

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return setError("Write something before posting.");
    if (text.length > PROJECT_UPDATE_LIMITS.bodyMax) {
      return setError(`Keep updates under ${PROJECT_UPDATE_LIMITS.bodyMax} characters.`);
    }
    underConstruction("Post update");
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-2">
      <FormField id={`${id}-body`} label="Post an update" markOptional={false} error={error}>
        {(aria) => (
          <Textarea
            {...aria}
            rows={3}
            maxLength={PROJECT_UPDATE_LIMITS.bodyMax}
            placeholder="What changed? e.g. The login page is ready for testing."
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (error) setError(undefined);
            }}
          />
        )}
      </FormField>
      <div className="flex justify-end">
        <Button type="submit">Post</Button>
      </div>
    </form>
  );
}
