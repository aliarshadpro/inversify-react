import { Container, ServiceIdentifier, GetOptions } from "inversify";
import { useContext, useRef } from "react";

import { InversifyReactContext } from "./internal";

/**
 * internal utility hook
 * @see https://reactjs.org/docs/hooks-faq.html#how-to-create-expensive-objects-lazily
 *
 * Q: why not `useMemo`?
 * A: it does not guarantee same instance
 * @see https://reactjs.org/docs/hooks-reference.html#usememo
 *
 * Q: why not `useState`?
 * A: it's possible to use state factory `useState(() => container.get(...))`,
 * but ref is probably slightly more optimal because it's not related to re-rendering
 * (which we don't need anyway)
 */
function useLazyRef<T>(resolveValue: () => T): T {
  const ref = useRef<{ v: T }>(null);
  if (!ref.current) {
    ref.current = { v: resolveValue() };
  }
  return ref.current.v;
}

/**
 * Resolves container or something from container (if you specify resolving function)
 */
export function useContainer(): Container;
export function useContainer<T>(resolve: (container: Container) => T): T;
export function useContainer<T>(
  resolve?: (container: Container) => T
): Container | T {
  const container = useContext(InversifyReactContext);
  if (!container) {
    throw new Error(
      "Cannot find Inversify container on React Context. " +
        "`Provider` component is missing in component tree."
    );
  }
  return resolve ? useLazyRef(() => resolve(container)) : container;
}

/**
 * Resolves injection by id (once, at first render).
 */
export function useInjection<T>(serviceId: ServiceIdentifier<T>): T {
  return useContainer((container) => container.get<T>(serviceId));
}

// overload with default value resolver;
// no restrictions on default `D` (e.g. `D extends T`) - freedom and responsibility of "user-land code"
export function useOptionalInjection<T, D>(
  serviceId: ServiceIdentifier<T>,
  // motivation:
  // to guarantee that "choosing the value" process happens exactly once and
  // to save users from potential bugs with naive `useOptionalInjection(...) ?? myDefault`;
  // this callback will be executed only if binding is not found on container
  resolveDefault: (container: Container) => D
): T | D;
// overload without default value resolver
export function useOptionalInjection<T>(
  serviceId: ServiceIdentifier<T>
): T | undefined;
/**
 * Resolves injection if it's bound in container
 */
export function useOptionalInjection<T, D>(
  serviceId: ServiceIdentifier<T>,
  resolveDefault: (container: Container) => D | undefined = () => undefined
): T | D | undefined {
  return useContainer((container) =>
    container.isBound(serviceId)
      ? container.get(serviceId)
      : resolveDefault(container)
  );
}

/**
 * uses container.getAll(), works like @multiInject()
 * https://github.com/inversify/InversifyJS/blob/master/wiki/container_api.md#containergetall
 * https://github.com/inversify/InversifyJS/blob/master/wiki/multi_injection.md
 */
export function useAllInjections<T>(
  serviceId: ServiceIdentifier<T>
): readonly T[] {
  return useContainer((container) => container.getAll(serviceId));
}

/**
 * uses container.get() with name option, works like @named decorator
 * https://github.com/inversify/InversifyJS/blob/master/wiki/named_bindings.md
 */
export function useNamedInjection<T>(
  serviceId: ServiceIdentifier<T>,
  named: string | number | symbol
): T {
  return useContainer((container) =>
    container.get<T>(serviceId, { name: named } as GetOptions)
  );
}

/**
 * uses container.get() with tag option, works like @tagged decorator
 * https://github.com/inversify/InversifyJS/blob/master/wiki/tagged_bindings.md
 */
export function useTaggedInjection<T>(
  serviceId: ServiceIdentifier<T>,
  key: string | number | symbol,
  value: unknown
): T {
  return useContainer((container) =>
    container.get<T>(serviceId, { tag: { key, value } } as GetOptions)
  );
}
