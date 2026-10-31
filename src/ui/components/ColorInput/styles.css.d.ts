declare namespace StylesCssNamespace {
  export interface IStylesCss {
    appear: string;
    area: string;
    channel: string;
    channels: string;
    close: string;
    editor: string;
    formats: string;
    header: string;
    hex: string;
    hue: string;
    hueThumb: string;
    row: string;
    swatch: string;
    thumb: string;
    title: string;
    tool: string;
    values: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
