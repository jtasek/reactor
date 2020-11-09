declare namespace StylesCssNamespace {
  export interface IStylesCss {
    bottom: string;
    center: string;
    handle: string;
    left: string;
    right: string;
    top: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
