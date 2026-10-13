declare namespace StylesCssNamespace {
  export interface IStylesCss {
    actions: string;
    card: string;
    cardBody: string;
    cardTitle: string;
    current: string;
    documentList: string;
    grid: string;
    header: string;
    iconActions: string;
    iconButton: string;
    meta: string;
    nameButton: string;
    nameInput: string;
    newButton: string;
    panel: string;
    thumbnail: string;
    thumbnailEmpty: string;
    thumbnailSvg: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
