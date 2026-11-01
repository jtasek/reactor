declare namespace PrototypeCssNamespace {
  export interface IPrototypeCss {
    controls: string;
    player: string;
    prototype: string;
    sharedLink: string;
    sharing: string;
  }
}

declare const PrototypeCssModule: PrototypeCssNamespace.IPrototypeCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: PrototypeCssNamespace.IPrototypeCss;
};

export = PrototypeCssModule;
