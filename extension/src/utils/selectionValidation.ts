const SUSPICIOUS_PATTERNS = [
  /\.venv/i,
  /scripts[\\/]+activate\.ps1/i,
  /npm\s+run/i,
  /python\s+-m/i,
  /c:[\\/]+users[\\/]+/i,
  /\bps\s+[a-z]:/i,
  /\bpowershell\b/i,
  /\bset-executionpolicy\b/i,
  /\bactivate\.ps1\b/i,
  /^[a-z]:[\\/]/i,
  /[\\/](node_modules|\.git|\.venv)[\\/]/i,
];

export function cleanSelectedText(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

export function isSuspiciousSelectedText(text: string): boolean {
  const normalized = cleanSelectedText(text);
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isReasonableSelectedText(text: string): boolean {
  const normalized = cleanSelectedText(text);
  return normalized.length > 0 && normalized.length <= 1500 && !isSuspiciousSelectedText(normalized);
}
