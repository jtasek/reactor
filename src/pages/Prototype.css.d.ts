declare namespace PrototypeCssNamespace {
  export interface IPrototypeCss {
    controls: string;
    dimensions: string;
    documentName: string;
    header: string;
    headerActions: string;
    identity: string;
    player: string;
    prototype: string;
    settings: string;
    sharedLink: string;
    sharing: string;
    toolbarSlot: string;
    viewportSummary: string;
  }
}

declare const PrototypeCssModule: PrototypeCssNamespace.IPrototypeCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: PrototypeCssNamespace.IPrototypeCss;
};

export = PrototypeCssModule;
