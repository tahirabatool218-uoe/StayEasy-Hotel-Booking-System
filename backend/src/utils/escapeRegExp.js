// Escapes user-supplied text before it is interpolated into a RegExp.
//
// Without this, a search term containing regex metacharacters either throws
// (e.g. "(" -> SyntaxError, surfacing as a 500) or allows pathological
// patterns that cause catastrophic backtracking (ReDoS), e.g. "(a+)+$".
// Escaping turns the input into a literal string, so it can only ever match
// itself.
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Upper bound on the length of any single search/filter term. Even fully
// escaped, an unbounded term is needless work for the database and an easy
// lever for a client to abuse.
const MAX_TERM_LENGTH = 120;

// Escapes and truncates a term for use in a RegExp. Returns null when the
// input is missing or contains nothing but whitespace, so callers can treat
// "no usable filter" uniformly.
const toSafeRegExpTerm = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return escapeRegExp(trimmed.slice(0, MAX_TERM_LENGTH));
};

module.exports = { escapeRegExp, toSafeRegExpTerm, MAX_TERM_LENGTH };
