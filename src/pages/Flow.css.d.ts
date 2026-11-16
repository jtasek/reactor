declare namespace FlowCssNamespace {
  export interface IFlowCss {
    add: string;
    badge: string;
    board: string;
    canvasLabel: string;
    check: string;
    checkCount: string;
    checkLabel: string;
    checkPanel: string;
    checkRoot: string;
    connections: string;
    control: string;
    documentName: string;
    dot: string;
    effect: string;
    empty: string;
    fit: string;
    fix: string;
    flow: string;
    group: string;
    groupMore: string;
    groupName: string;
    groupNote: string;
    handle: string;
    hidden: string;
    history: string;
    list: string;
    live: string;
    more: string;
    name: string;
    newState: string;
    noteDot: string;
    notice: string;
    play: string;
    problem: string;
    screen: string;
    screenName: string;
    sentence: string;
    startMark: string;
    summary: string;
    thumb: string;
    title: string;
    toolbar: string;
    world: string;
  }
}

declare const FlowCssModule: FlowCssNamespace.IFlowCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: FlowCssNamespace.IFlowCss;
};

export = FlowCssModule;
