import { describe, expect, it } from "vitest";

import { checkFile } from "./check-file";

describe("checkFile", () => {
  it("accepts PDF and DOCX files within the limit", () => {
    expect(checkFile({ name: "Brief.PDF", size: 10 })).toBeNull();
    expect(checkFile({ name: "spec.docx", size: 10 })).toBeNull();
  });

  it.each([
    [{ name: "notes.txt", size: 10 }, "Upload a PDF or DOCX file."],
    [{ name: "brief", size: 10 }, "Upload a PDF or DOCX file."],
    [{ name: "empty.pdf", size: 0 }, "This file is empty."],
    [{ name: "big.pdf", size: 10 * 1024 * 1024 + 1 }, "Files can be at most 10 MB."],
  ])("refuses %o", (file, message) => expect(checkFile(file)).toBe(message));
});
