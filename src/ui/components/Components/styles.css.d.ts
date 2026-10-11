declare namespace StylesCssNamespace {
  export interface IStylesCss {
    components: string;
    empty: string;
    heading: string;
    iconButton: string;
    label: string;
    list: string;
    row: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
