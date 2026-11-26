declare namespace PrototypeCssNamespace {
  export interface IPrototypeCss {
    combinations: string;
    contexts: string;
    controls: string;
    copy: string;
    copyLabel: string;
    dimensions: string;
    documentName: string;
    header: string;
    headerActions: string;
    identity: string;
    linkPill: string;
    linkRow: string;
    links: string;
    player: string;
    prototype: string;
    revoke: string;
    shareChips: string;
    shareNote: string;
    sharePicture: string;
    shareState: string;
    shareSummary: string;
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
