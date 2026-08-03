export const PATH_PARAM = /:([A-Za-z0-9_]+)/g;

export const extractPathParams = (path: string): string[] => {
  const params: string[] = [];
  for (const match of path.matchAll(PATH_PARAM)) {
    params.push(match[1] ?? "");
  }
  return params;
};

export const fillPath = (
  template: string,
  params: Readonly<Record<string, unknown>>,
): string =>
  template.replace(PATH_PARAM, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing param '${name}' for path '${template}'.`);
    }
    return encodeURIComponent(String(value));
  });
