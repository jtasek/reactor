declare namespace StylesCssNamespace {
  export interface IStylesCss {
    active: string;
    dropTarget: string;
    grip: string;
    hidden: string;
    icon: string;
    icons: string;
    label: string;
    layer: string;
    name: string;
    outline: string;
    row: string;
    selected: string;
    showAll: string;
    shown: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
