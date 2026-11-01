import { PROJECT_LIMITS } from "@/entities/project";

/** Quick checks before uploading, so an obvious mistake doesn't wait on the
 * network. The API checks the file's real contents and the limits again. */
export function checkFile(file: { name: string; size: number }, maxBytes: number = PROJECT_LIMITS.documentBytes): string | null {
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (extension !== "pdf" && extension !== "docx") return "Upload a PDF or DOCX file.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > maxBytes) return `Files can be at most ${maxBytes / (1024 * 1024)} MB.`;
  return null;
}
