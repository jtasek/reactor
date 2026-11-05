declare namespace FlowCssNamespace {
  export interface IFlowCss {
    badge: string;
    board: string;
    connections: string;
    diagram: string;
    documentName: string;
    flow: string;
    handle: string;
    hint: string;
    screen: string;
    selectionHeader: string;
    start: string;
    workspace: string;
  }
}

declare const FlowCssModule: FlowCssNamespace.IFlowCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: FlowCssNamespace.IFlowCss;
};

export = FlowCssModule;
