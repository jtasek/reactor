declare namespace StylesCssNamespace {
  export interface IStylesCss {
    form: string;
    message: string;
    operations: string;
    problem: string;
    prompt: string;
    proposal: string;
    status: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
