declare namespace StylesCssNamespace {
  export interface IStylesCss {
    active: string;
    badge: string;
    bottomLeft: string;
    bottomRight: string;
    gripAcross: string;
    gripDown: string;
    handle: string;
    marginBands: string;
    middleBottom: string;
    middleLeft: string;
    middleRight: string;
    middleTop: string;
    paddingBands: string;
    radius: string;
    rotate: string;
    rotateLine: string;
    spacingBand: string;
    spacingBands: string;
    spacingGrip: string;
    spacingValue: string;
    topLeft: string;
    topRight: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
