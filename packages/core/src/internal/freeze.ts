export const freeze = <T>(value: T): T => Object.freeze(value);

const isFreezable = (value: unknown): boolean =>
  Array.isArray(value) ||
  value instanceof Map ||
  Object.getPrototypeOf(value) === Object.prototype ||
  Object.getPrototypeOf(value) === null;

export const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && isFreezable(value)) {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze((value as Record<PropertyKey, unknown>)[key as PropertyKey]);
    }
    Object.freeze(value);
  }
  return value;
};
