declare namespace StylesCssNamespace {
  export interface IStylesCss {
    back: string;
    component: string;
    contextMenu: string;
    danger: string;
    divider: string;
    editButton: string;
    header: string;
    nameButton: string;
    nameInput: string;
    row: string;
    rowLabel: string;
    trailing: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
