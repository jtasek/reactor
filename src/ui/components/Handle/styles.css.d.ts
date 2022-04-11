declare namespace StylesCssNamespace {
  export interface IStylesCss {
    bottomLeft: string;
    bottomRight: string;
    handle: string;
    middleBottom: string;
    middleLeft: string;
    middleRight: string;
    middleTop: string;
    topLeft: string;
    topRight: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
