export const freeze = <Value extends object>(value: Value): Readonly<Value> =>
  Object.freeze(value);
