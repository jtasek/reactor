declare namespace StylesCssNamespace {
  export interface IStylesCss {
    columnGrip: string;
    grips: string;
    line: string;
    position: string;
    removing: string;
    rowGrip: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
