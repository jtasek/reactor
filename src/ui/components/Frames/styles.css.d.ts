declare namespace StylesCssNamespace {
  export interface IStylesCss {
    active: string;
    edge: string;
    frame: string;
    handle: string;
    hit: string;
    label: string;
    selected: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
