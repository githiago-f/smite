export const freeze = <Value extends object>(value: Value): Readonly<Value> =>
  Object.freeze(value);

export const freezeArray = <Value>(
  values: readonly Value[],
): readonly Value[] => Object.freeze([...values]);
