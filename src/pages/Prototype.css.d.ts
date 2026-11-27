declare namespace PrototypeCssNamespace {
  export interface IPrototypeCss {
    back: string;
    bar: string;
    barActions: string;
    combinations: string;
    contexts: string;
    controls: string;
    controlsRow: string;
    copy: string;
    copyLabel: string;
    customFields: string;
    customSize: string;
    deviceButton: string;
    deviceEmpty: string;
    deviceGroup: string;
    deviceMenu: string;
    deviceRow: string;
    deviceSearch: string;
    documentName: string;
    identity: string;
    linkPill: string;
    linkRow: string;
    links: string;
    moreMenu: string;
    outline: string;
    outlineBox: string;
    player: string;
    popover: string;
    popoverRoot: string;
    prototype: string;
    revoke: string;
    roundButton: string;
    shareChips: string;
    shareNote: string;
    sharePicture: string;
    shareState: string;
    shareSummary: string;
    sharedLink: string;
    sharing: string;
    summary: string;
  }
}

declare const PrototypeCssModule: PrototypeCssNamespace.IPrototypeCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: PrototypeCssNamespace.IPrototypeCss;
};

export = PrototypeCssModule;
