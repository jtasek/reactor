declare namespace ServerDeletedCssNamespace {
  export interface IServerDeletedCss {
    serverDeleted: string;
  }
}

declare const ServerDeletedCssModule: ServerDeletedCssNamespace.IServerDeletedCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: ServerDeletedCssNamespace.IServerDeletedCss;
};

export = ServerDeletedCssModule;
