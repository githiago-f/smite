/**
 * Deep-freezes a parsed snapshot so a value object or entity value can never be
 * mutated after construction.
 */
export const freezeDeep = <Value>(value: Value): Readonly<Value> => {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      (value as Record<string, unknown>)[key] = freezeDeep(
        (value as Record<string, unknown>)[key],
      );
    }
    Object.freeze(value);
  }
  return value as Readonly<Value>;
};

/**
 * Structural equality over plain values: primitives, arrays and objects.
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      a.every((value, index) => deepEqual(value, b[index]))
    );
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === "object" &&
    typeof b === "object"
  ) {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key) =>
        deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
      )
    );
  }
  return false;
};

/**
 * Recursively sorts object keys so two structurally equal values canonicalize
 * to the same string regardless of key order.
 */
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [
          key,
          canonicalize((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return value;
};

/**
 * Stable canonical string for a value, usable as a Set/Map key.
 */
export const hashOf = (value: unknown): string =>
  JSON.stringify(canonicalize(value));
