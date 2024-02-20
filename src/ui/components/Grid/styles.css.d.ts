declare namespace StylesCssNamespace {
  export interface IStylesCss {
    grid: string;
    "grid-lines-large": string;
    "grid-lines-small": string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
