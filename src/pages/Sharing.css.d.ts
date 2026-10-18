declare namespace SharingCssNamespace {
  export interface ISharingCss {
    card: string;
    content: string;
    list: string;
    page: string;
    person: string;
    preview: string;
    result: string;
    secondary: string;
  }
}

declare const SharingCssModule: SharingCssNamespace.ISharingCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: SharingCssNamespace.ISharingCss;
};

export = SharingCssModule;
