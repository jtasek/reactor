declare namespace StylesCssNamespace {
  export interface IStylesCss {
    align: string;
    alignRow: string;
    bound: string;
    color: string;
    heading: string;
    inspector: string;
    note: string;
    variablePicker: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
