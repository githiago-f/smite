type Methods = Readonly<Record<string, (...args: never[]) => unknown>>;

/**
 * Attaches builder methods to a descriptor as non-enumerable properties, so the
 * descriptor still reads as a plain IR node (`Object.keys` sees only
 * `__kind`/`__key`/`data`) while carrying its reference-based builder surface.
 */
export const withMethods = <Target extends object, M extends Methods>(
  target: Target,
  methods: M,
): Target & M => {
  for (const [key, value] of Object.entries(methods)) {
    Object.defineProperty(target, key, {
      configurable: false,
      enumerable: false,
      writable: false,
      value,
    });
  }
  return target as Target & M;
};
