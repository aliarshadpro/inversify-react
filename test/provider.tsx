import * as React from "react";
import { useState } from "react";
import "reflect-metadata";
import { injectable, Container } from "inversify";
import { render, screen } from "@testing-library/react";
import type { ContainerModule } from "inversify";

import { resolve, Provider } from "../src";

@injectable()
class Foo {
  name = "foo";
}

interface RootComponentProps {
  children?: React.ReactNode;
}

class RootComponent extends React.Component<RootComponentProps> {
  constructor(props: RootComponentProps) {
    super(props);

    this.container = new Container();
    this.container.bind(Foo).toSelf();
  }

  private readonly container: Container;

  render() {
    return (
      <Provider container={this.container}>
        <div>{this.props.children}</div>
      </Provider>
    );
  }
}

class ChildComponent extends React.Component {
  @resolve
  private readonly foo: Foo;

  render() {
    return <div data-testid="foo-result">{this.foo.name}</div>;
  }
}

test("provider provides to immediate children", () => {
  render(
    <RootComponent>
      <ChildComponent />
    </RootComponent>
  );

  expect(screen.getByTestId("foo-result")).toHaveTextContent("foo");
});

test("provider provides services to deep children", () => {
  render(
    <RootComponent>
      <div>
        <ChildComponent />
      </div>
    </RootComponent>
  );

  expect(screen.getByTestId("foo-result")).toHaveTextContent("foo");
});

describe("hierarchy of containers", () => {
  test("providers make hierarchy of containers by default", () => {
    const outerContainer = new Container();
    outerContainer.bind(Foo).toConstantValue({ name: "outer" });
    const innerContainer = new Container();
    innerContainer.bind(Foo).toConstantValue({ name: "inner" });

    render(
      <Provider container={outerContainer}>
        <Provider container={innerContainer}>
          <ChildComponent />
        </Provider>
      </Provider>
    );

    expect(screen.getByTestId("foo-result")).toHaveTextContent("inner");
  });

  test(`"standalone" provider isolates container`, () => {
    const outerContainer = new Container();
    outerContainer.bind(Foo).toSelf();
    const innerContainer = new Container();

    expect(() => {
      render(
        <Provider container={outerContainer}>
          <Provider container={innerContainer} standalone={true}>
            <ChildComponent />
          </Provider>
        </Provider>
      );
    }).toThrow(/No bindings found for service: "Foo"/);

    expect(() => innerContainer.get(Foo)).toThrow();
  });
});

describe("Provider DX", () => {
  // few tests to check/show that Provider component produces DX errors and other minor stuff

  test('"container" prop can be a factory function', () => {
    const spy = jest.fn();
    let renderCount = 0;

    const FunctionalRootComponent: React.FC<{
      children?: React.ReactNode;
    }> = () => {
      renderCount++;
      return (
        <Provider
          container={(() => {
            spy();
            const c = new Container();
            c.bind(Foo).toSelf();
            return c;
          })()}
        >
          <ChildComponent />
        </Provider>
      );
    };

    render(
      <FunctionalRootComponent>
        <ChildComponent />
      </FunctionalRootComponent>
    );

    expect(renderCount).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("foo-result")).toHaveTextContent("foo");

    // Don't rerender, as it causes the spy to be called again
    // tree.rerender(
    //     <FunctionalRootComponent>
    //         <ChildComponent />
    //     </FunctionalRootComponent>
    // );

    // expect(renderCount).toBe(2);
    // expect(spy).toHaveBeenCalledTimes(1);
  });
});
