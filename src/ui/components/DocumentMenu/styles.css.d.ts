declare namespace StylesCssNamespace {
  export interface IStylesCss {
    documentMenu: string;
    label: string;
    menu: string;
    trigger: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
