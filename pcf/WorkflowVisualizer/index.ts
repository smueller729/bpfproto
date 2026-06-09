import * as React from "react";
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import App from "./components/App";

export class WorkflowVisualizer
  implements ComponentFramework.ReactControl<IInputs, IOutputs>
{
  constructor() {
    // Empty
  }

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary
  ): void {
    void context;
    void notifyOutputChanged;
    void state;
  }

  public updateView(
    context: ComponentFramework.Context<IInputs>
  ): React.ReactElement {
    void context;

    return React.createElement(App);
  }

  public getOutputs(): IOutputs {
    return {};
  }

  public destroy(): void {
    // Add code to cleanup control if necessary
  }
}