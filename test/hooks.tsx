import "reflect-metadata";
import {
  Container,
  injectable,
  unmanaged,
  type ServiceIdentifier,
} from "inversify";
import * as React from "react";
import { useState } from "react";
import { assert, IsExact } from "conditional-type-checks";
import { render, screen } from "@testing-library/react";
import type { ContainerModule } from "inversify";

import * as hooksModule from "../src/hooks"; // for jest.spyOn
import {
  Provider,
  useAllInjections,
  useContainer,
  useInjection,
  useOptionalInjection,
  useNamedInjection,
  useTaggedInjection,
} from "../src";

// We want to test types around hooks with signature overloads (as it's more complex),
// but don't actually execute them,
// so we wrap test code into a dummy function just for TypeScript compiler
function staticTypecheckOnly(_fn: () => void) {
  return () => {};
}

function throwErr(msg: string): never {
  throw new Error(msg);
}

@injectable()
class Foo {
  readonly name = "foo";
}

@injectable()
class Bar {
  readonly name: string;

  constructor(@unmanaged() tag: string) {
    this.name = "bar-" + tag;
  }
}

const aName = "a-name";
const bName = "b-name";
const rootTag = "tag";
const aTag = "a-tag";
const bTag = "b-tag";
const multiId = Symbol("multi-id");

class OptionalService {
  readonly label = "OptionalService" as const;
}

interface RootComponentProps {
  children?: React.ReactNode;
}

const RootComponent: React.FC<RootComponentProps> = ({ children }) => {
  const [container] = useState(() => {
    const c = new Container();
    c.bind(Foo).toSelf();
    c.bind(Bar)
      .toDynamicValue(() => new Bar("aNamed"))
      .whenParentNamed(aName);
    c.bind(Bar)
      .toDynamicValue(() => new Bar("bNamed"))
      .whenParentNamed(bName);
    c.bind(Bar)
      .toDynamicValue(() => new Bar("aTagged"))
      .whenParentTagged(rootTag, aTag);
    c.bind(Bar)
      .toDynamicValue(() => new Bar("bTagged"))
      .whenParentTagged(rootTag, bTag);
    c.bind(multiId).toConstantValue("x");
    c.bind(multiId).toConstantValue("y");
    c.bind(multiId).toConstantValue("z");
    return c;
  });
  return (
    <Provider container={container}>
      <div>{children}</div>
    </Provider>
  );
};

describe("useContainer hook", () => {
  const hookSpy = jest.spyOn(hooksModule, "useContainer");
  const ChildComponent = () => {
    const resolvedContainer = useContainer();
    return (
      <div data-testid="container-result">
        {resolvedContainer ? "container" : "no container"}
      </div>
    );
  };

  afterEach(() => {
    hookSpy.mockClear();
  });

  // hook with overloads, so we test types
  test(
    "types",
    staticTypecheckOnly(() => {
      const container = useContainer();
      assert<IsExact<typeof container, Container>>(true);

      const valueResolvedFromContainer = useContainer((c) => {
        assert<IsExact<typeof c, Container>>(true);
        return c.get(Foo);
      });
      assert<IsExact<typeof valueResolvedFromContainer, Foo>>(true);
    })
  );

  test("resolves container from context", () => {
    const container = new Container();

    render(
      <Provider container={container}>
        <ChildComponent />
      </Provider>
    );

    expect(hookSpy).toHaveBeenCalledTimes(1);
    expect(hookSpy).toHaveLastReturnedWith(container);
    expect(screen.getByTestId("container-result")).toHaveTextContent(
      "container"
    );
  });

  test("throws when no context found (missing Provider)", () => {
    expect(() => {
      render(<ChildComponent />);
    }).toThrow("Cannot find Inversify container on React Context");

    expect(hookSpy).toHaveBeenCalled();
  });
});

describe("useInjection hook", () => {
  test("resolves using service identifier (newable)", () => {
    const ChildComponent = () => {
      const foo = useInjection<Foo>(Foo);
      if (!foo) throw new Error("Foo not found");
      return <div data-testid="result">{foo.name}</div>;
    };

    const container = new Container();
    container.bind(Foo).toSelf();

    render(
      <Provider container={container}>
        <ChildComponent />
      </Provider>
    );

    expect(screen.getByTestId("result")).toHaveTextContent("foo");
  });

  test("resolves using service identifier (string)", () => {
    const container = new Container();
    container.bind("FooFoo").to(Foo);

    const ChildComponent = () => {
      const foo = useInjection<Foo>("FooFoo");
      return <div data-testid="string-id-result">{foo.name}</div>;
    };

    render(
      <Provider container={container}>
        <ChildComponent />
      </Provider>
    );

    expect(screen.getByTestId("string-id-result")).toHaveTextContent("foo");
  });

  test("resolves using service identifier (symbol)", () => {
    // NB! declaring symbol as explicit ServiceIdentifier of specific type,
    // which gives extra safety through type inference (both when binding and resolving)
    const identifier = Symbol("Foo") as ServiceIdentifier<Foo>;

    const container = new Container();
    container.bind(identifier).to(Foo);

    const ChildComponent = () => {
      const foo = useInjection<Foo>(identifier);
      return <div data-testid="symbol-id-result">{foo.name}</div>;
    };

    render(
      <Provider container={container}>
        <ChildComponent />
      </Provider>
    );

    expect(screen.getByTestId("symbol-id-result")).toHaveTextContent("foo");
  });
});

describe("useNamedInjection hook", () => {
  test("resolves using service identifier and name constraint", () => {
    const container = new Container();

    // Register Bar with named bindings
    container
      .bind(Bar)
      .toDynamicValue(() => new Bar("aNamed"))
      .whenNamed(aName);
    container
      .bind(Bar)
      .toDynamicValue(() => new Bar("bNamed"))
      .whenNamed(bName);

    const ChildComponent = () => {
      const aBar = useNamedInjection(Bar, aName);
      const bBar = useNamedInjection(Bar, bName);

      return (
        <div data-testid="named-result">
          {aBar.name},{bBar.name}
        </div>
      );
    };

    render(
      <Provider container={container}>
        <ChildComponent />
      </Provider>
    );

    expect(screen.getByTestId("named-result")).toHaveTextContent(
      "bar-aNamed,bar-bNamed"
    );
  });
});

describe("useTaggedInjection hook", () => {
  test("resolves using service identifier and tag constraint", () => {
    const container = new Container();

    // Register Bar with tagged bindings
    container
      .bind(Bar)
      .toDynamicValue(() => new Bar("aTagged"))
      .whenTagged(rootTag, aTag);
    container
      .bind(Bar)
      .toDynamicValue(() => new Bar("bTagged"))
      .whenTagged(rootTag, bTag);

    const ChildComponent = () => {
      const aBar = useTaggedInjection(Bar, rootTag, aTag);
      const bBar = useTaggedInjection(Bar, rootTag, bTag);

      return (
        <div data-testid="tagged-result">
          {aBar.name},{bBar.name}
        </div>
      );
    };

    render(
      <Provider container={container}>
        <ChildComponent />
      </Provider>
    );

    expect(screen.getByTestId("tagged-result")).toHaveTextContent(
      "bar-aTagged,bar-bTagged"
    );
  });
});

describe("useOptionalInjection hook", () => {
  const hookSpy = jest.spyOn(hooksModule, "useOptionalInjection");

  afterEach(() => {
    hookSpy.mockClear();
  });

  // hook with overloads, so we test types
  test(
    "types",
    staticTypecheckOnly(() => {
      const opt = useOptionalInjection(Foo);
      assert<IsExact<typeof opt, Foo | undefined>>(true);

      const optWithDefault = useOptionalInjection(
        Foo,
        () => "default" as const
      );
      assert<IsExact<typeof optWithDefault, Foo | "default">>(true);
    })
  );

  test("returns undefined for missing injection/binding", () => {
    const ChildComponent = () => {
      const optionalThing = useOptionalInjection(OptionalService);
      return (
        <>{optionalThing === undefined ? "missing" : throwErr("unexpected")}</>
      );
    };

    const tree = render(
      <RootComponent>
        <ChildComponent />
      </RootComponent>
    );

    const fragment = tree.asFragment();

    expect(hookSpy).toHaveBeenCalledTimes(1);
    expect(hookSpy).toHaveReturnedWith(undefined);
    expect(fragment.children[0].textContent).toEqual("missing");
  });

  test("resolves using fallback to default value", () => {
    const defaultThing = {
      label: "myDefault",
      isMyDefault: true,
    } as const;
    const ChildComponent = () => {
      const defaultFromOptional = useOptionalInjection(
        OptionalService,
        () => defaultThing
      );
      if (defaultFromOptional instanceof OptionalService) {
        throwErr("unexpected");
      } else {
        assert<IsExact<typeof defaultFromOptional, typeof defaultThing>>(true);
        expect(defaultFromOptional).toBe(defaultThing);
      }

      return <>{defaultFromOptional.label}</>;
    };

    const tree = render(
      <RootComponent>
        <ChildComponent />
      </RootComponent>
    );

    const fragment = tree.asFragment();

    expect(hookSpy).toHaveBeenCalledTimes(1);
    expect(hookSpy).toHaveReturnedWith(defaultThing);
    expect(fragment.children[0].textContent).toEqual(defaultThing.label);
  });

  test("resolves if injection/binding exists", () => {
    const ChildComponent = () => {
      const foo = useOptionalInjection(Foo);
      return (
        <>
          {foo !== undefined
            ? foo.name
            : throwErr("Cannot resolve injection for Foo")}
        </>
      );
    };

    const tree = render(
      <RootComponent>
        <ChildComponent />
      </RootComponent>
    );

    const fragment = tree.asFragment();

    expect(hookSpy).toHaveBeenCalledTimes(1);
    expect(fragment.children[0].textContent).toEqual("foo");
  });
});

describe("useAllInjections hook", () => {
  const hookSpy = jest.spyOn(hooksModule, "useAllInjections");

  afterEach(() => {
    hookSpy.mockClear();
  });

  test("resolves all injections", () => {
    const ChildComponent = () => {
      const stuff = useAllInjections(multiId);
      return <>{stuff.join(",")}</>;
    };

    const tree = render(
      <RootComponent>
        <ChildComponent />
      </RootComponent>
    );

    const fragment = tree.asFragment();

    expect(hookSpy).toHaveBeenCalledTimes(1);
    expect(fragment.children[0].textContent).toEqual("x,y,z");
  });
});
