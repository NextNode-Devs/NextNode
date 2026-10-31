"use server";

import { redirect } from "next/navigation";

import { portfolioHref, type Portfolio } from "@/entities/developer";
import { apiPut } from "@/shared/api/server-client";

import { fieldErrorsFromApi, toRequestBody, type FieldErrors, type PortfolioDraft } from "../model/draft";

export type SaveFailure = { code: string; message: string; fields: FieldErrors };

function failureMessage(code: string, message: string): string {
  switch (code) {
    case "VALIDATION_ERROR":
      return "Some details need attention. Check the highlighted fields.";
    case "UNAUTHENTICATED":
      return "Your session has ended. Sign in again, then save your portfolio.";
    case "UNREACHABLE":
    case "BAD_RESPONSE":
      return "We couldn't reach NextNode, so nothing was saved. Check your connection and try again.";
    default:
      return message || "Something went wrong, so nothing was saved. Try again.";
  }
}

/**
 * Saves the signed-in developer's whole portfolio, then opens it with a
 * "Portfolio saved" confirmation. Only the owner can save: the API answers
 * 403 to anyone else, and this action can only address "me".
 */
export async function savePortfolio(draft: PortfolioDraft): Promise<SaveFailure> {
  const result = await apiPut<Portfolio>("/api/developers/me/portfolio/", toRequestBody(draft), {
    auth: true,
    timeoutMs: 8000,
  });
  if (!result.ok) {
    return {
      code: result.error.code,
      message: failureMessage(result.error.code, result.error.message),
      fields: fieldErrorsFromApi(result.error.fields),
    };
  }
  redirect(`${portfolioHref(result.data.account_id)}?saved=1`); // throws to navigate; keep outside any try
}
