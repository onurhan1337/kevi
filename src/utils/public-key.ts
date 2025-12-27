type PatternCache = {
  exact: Set<string>;
  wildcards: readonly string[];
};

const patternCache = new Map<string, PatternCache>();

export function isPublicKey(
  key: string,
  serviceId: string,
  publicKeys?: readonly string[]
): boolean {
  if (!publicKeys || publicKeys.length === 0) {
    return false;
  }

  let patterns = patternCache.get(serviceId);

  if (!patterns) {
    const exactMatches = new Set<string>();
    const wildcardPrefixes: string[] = [];

    for (const pattern of publicKeys) {
      if (pattern.endsWith("*")) {
        wildcardPrefixes.push(pattern.slice(0, -1));
      } else {
        exactMatches.add(pattern);
      }
    }

    patterns = {
      exact: exactMatches,
      wildcards: wildcardPrefixes,
    };

    patternCache.set(serviceId, patterns);
  }

  if (patterns.exact.has(key)) {
    return true;
  }

  for (const prefix of patterns.wildcards) {
    if (key.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}
