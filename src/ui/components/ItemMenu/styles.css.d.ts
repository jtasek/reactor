declare namespace StylesCssNamespace {
  export interface IStylesCss {
    beside: string;
    button: string;
    menu: string;
    more: string;
    onLeft: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
