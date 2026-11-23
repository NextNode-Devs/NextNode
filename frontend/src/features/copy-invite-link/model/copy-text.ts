/**
 * Puts text on the clipboard. Resolves `false` instead of throwing when the
 * browser refuses (no permission, an insecure origin, an old browser), so the
 * screen can tell people to copy the link themselves.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
