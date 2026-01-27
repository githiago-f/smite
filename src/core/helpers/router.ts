type Params = Readonly<Record<string, string>>;

type MatchResult =
    | { readonly matched: true; readonly params: Params }
    | { readonly matched: false };

type Segment =
    | { readonly kind: "static"; readonly value: string }
    | {
          readonly kind: "param";
          readonly name: string;
          readonly optional: boolean;
      };

const normalize = (p: string): readonly string[] =>
    p
        .replaceAll(/(^\/+|\/+$)/g, "")
        .split("/")
        .filter(Boolean);

const compile = (pattern: string): readonly Segment[] =>
    normalize(pattern).map((seg) => {
        if (!seg.startsWith("{")) {
            return { kind: "static", value: seg };
        }

        const optional = seg.endsWith("?}");
        const name = seg.slice(1, optional ? -2 : -1);

        return { kind: "param", name, optional };
    });

const matchCompiled =
    (segments: readonly Segment[]) =>
    (path: string): MatchResult => {
        const parts = normalize(path);

        const result = segments.reduce<{
            ok: boolean;
            index: number;
            params: Record<string, string>;
        }>(
            (acc, seg) => {
                if (!acc.ok) return acc;

                const value = parts[acc.index];

                if (seg.kind === "static") {
                    return value === seg.value
                        ? { ...acc, index: acc.index + 1 }
                        : { ...acc, ok: false };
                }

                // param
                if (value == null) {
                    return seg.optional ? acc : { ...acc, ok: false };
                }

                return {
                    ...acc,
                    index: acc.index + 1,
                    params: { ...acc.params, [seg.name]: value },
                };
            },
            { ok: true, index: 0, params: {} },
        );

        return result.ok && result.index === parts.length
            ? { matched: true, params: result.params }
            : { matched: false };
    };

export const createRouteMatcher = (pattern: string) =>
    matchCompiled(compile(pattern));
