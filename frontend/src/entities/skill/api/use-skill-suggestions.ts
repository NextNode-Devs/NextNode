"use client";

import { useEffect, useState } from "react";

import { useApiClient } from "@/shared/api/browser-client";

import type { SkillOption } from "../model/skill";

const DEBOUNCE_MS = 200;

/**
 * Skills other developers already entered that match `query` (#1's
 * `GET /api/skills/`). Suggestions keep spellings consistent; any skill can
 * still be typed. Failures just mean no suggestions.
 */
export function useSkillSuggestions(query: string): SkillOption[] {
  const api = useApiClient();
  const [suggestions, setSuggestions] = useState<SkillOption[]>([]);
  const text = query.trim();

  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await api.get<SkillOption[]>(`/api/skills/?q=${encodeURIComponent(text)}`);
      if (!cancelled) setSuggestions(result.ok ? result.data.slice(0, 8) : []);
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, text]);

  return text ? suggestions : [];
}
