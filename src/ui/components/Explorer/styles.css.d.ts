declare namespace StylesCssNamespace {
  export interface IStylesCss {
    active: string;
    dropTarget: string;
    explorer: string;
    grip: string;
    hidden: string;
    icon: string;
    label: string;
    layer: string;
    name: string;
    row: string;
    selected: string;
    showAll: string;
    shown: string;
    toggle: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
