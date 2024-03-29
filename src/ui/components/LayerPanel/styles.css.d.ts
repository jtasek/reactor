declare namespace StylesCssNamespace {
  export interface IStylesCss {
    icons: string;
    layerItem: string;
    layerLabel: string;
    layerPanel: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
