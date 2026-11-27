declare namespace StylesCssNamespace {
  export interface IStylesCss {
    preview: string;
    retry: string;
    select: string;
    toolbar: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
