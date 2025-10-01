import { lazy } from "react";

/** Lazily import a module that uses named exports (no default). */
export function lazyNamed<T extends object, K extends keyof T>(
  loader: () => Promise<T>,
  name: K
) {
  return lazy(async () => {
    const m = await loader();
    return { default: m[name] as any };
  });
}
