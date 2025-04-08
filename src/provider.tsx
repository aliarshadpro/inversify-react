import * as React from "react";
import { useContext, useState } from "react";
import { Container, ServiceIdentifier, Newable } from "inversify";
import { InversifyReactContext } from "./internal";

type ProviderProps = Readonly<{
  // Inversify container (or container factory) to be used for that React subtree (children of Provider)
  container: Container;

  // Hierarchical DI configuration:
  // standalone Provider will keep container isolated,
  // otherwise (default behavior) it will try to find parent container in React tree
  // and establish hierarchy of containers
  // @see https://github.com/inversify/InversifyJS/blob/master/wiki/hierarchical_di.md
  standalone?: boolean;

  children?: React.ReactNode;

  // TODO:ideas: more callbacks?
  //  ---
  //  `onReady?: (container: interfaces.Container) => void`
  //  before first render, but when hierarchy is already setup (because parent container might be important ofc),
  //  e.g. to preinit something, before it gets used by some components:
  //  ```
  //  onReady={container => {
  //    // e.g. when container comes from business-logic-heavy external module, independent from UI (React),
  //    // and requires a little bit of additional UI-based configuration
  //    container.get(Foo).initBasedOnUI(...)
  //  }}
  //  ```
  //  ---
  //  `onParent?: (self: interfaces.Container, parent: interfaces.Container) => interfaces.Container`
  //  middleware-like behavior where we could intercept parent container and interfere with hierarchy or something
  //
}>;

// very basic typeguard, but should be enough for local usage
function isContainer(x: ProviderProps["container"]): x is Container {
  return "resolve" in x;
}

const Provider: React.FC<ProviderProps> = ({
  children,
  container: containerProp,
  standalone: standaloneProp = false,
}) => {
  // #DX: guard against `container` prop change and warn with explicit error
  const [container] = useState(containerProp);
  // ...but only if it's an actual Container and not a factory function (factory can be a new function on each render)
  if (isContainer(containerProp) && containerProp !== container) {
    throw new Error(
      "Changing `container` prop (swapping container in runtime) is not supported.\n" +
        "If you're rendering Provider in some list, try adding `key={container.id}` to the Provider.\n" +
        "More info on React lists:\n" +
        "https://reactjs.org/docs/lists-and-keys.html#keys\n" +
        "https://reactjs.org/docs/reconciliation.html#recursing-on-children"
    );
  }

  // #DX: guard against `standalone` prop change and warn with explicit error
  const [standalone] = useState(standaloneProp);
  if (standaloneProp !== standalone) {
    throw new Error(
      "Changing `standalone` prop is not supported." // ...does it make any sense to change it?
    );
  }

  // we bind our container to parent container BEFORE first render,
  // so that children would be able to resolve stuff from parent containers
  const parentContainer = useContext(InversifyReactContext);
  useState(function prepareContainer() {
    if (!standalone && parentContainer) {
      if (parentContainer === container) {
        throw new Error(
          "Provider has found a parent container (on surrounding React Context), " +
            "yet somehow it's the same as container specified in props. It doesn't make sense.\n" +
            "Perhaps you meant to configure Provider as `standalone={true}`?"
        );
      }

      // Create a new container with the parent container
      const newContainer = new Container({ parent: parentContainer });

      // Copy all bindings from the original container to the new one
      // In v7, we need to handle this differently since we can't directly access bindings
      try {
        // We'll try to get all bound services by attempting to resolve them
        // This is not ideal but it's the best we can do with the v7 API
        const boundServices = new Set<ServiceIdentifier<unknown>>();

        // First, try to get all services that are explicitly bound
        container
          .get<ServiceIdentifier<unknown>[]>("__inversify_types__")
          ?.forEach((type) => {
            try {
              const instance = container.get(type);
              if (instance) {
                boundServices.add(type);
              }
            } catch (e) {
              // Ignore resolution errors
            }
          });

        // Copy the bindings to the new container
        boundServices.forEach((serviceId) => {
          try {
            const instance = container.get(serviceId);
            if (typeof instance === "function" && "prototype" in instance) {
              newContainer.bind(serviceId).to(instance as Newable<unknown>);
            } else {
              newContainer.bind(serviceId).toConstantValue(instance);
            }
          } catch (e) {
            // Ignore binding errors
          }
        });
      } catch (e) {
        console.warn(
          "Could not copy all bindings from the original container:",
          e
        );
      }

      // Replace the original container with the new one
      Object.assign(container, newContainer);
    }
  });

  return (
    <InversifyReactContext.Provider value={container}>
      {children}
    </InversifyReactContext.Provider>
  );
};

export { ProviderProps, Provider };
export default Provider;
