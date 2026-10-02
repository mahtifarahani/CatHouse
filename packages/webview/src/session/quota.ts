/** Match Claude's quota response without offering a host switch for unrelated errors. */
export function isClaudeSessionLimit(message: string | undefined): boolean {
  return (
    !!message &&
    /(?:you(?:'|’)ve hit your session limit|session limit reached|you(?:'|’)ve reached your usage limit)/i.test(
      message,
    )
  );
}
