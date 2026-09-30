declare namespace StylesCssNamespace {
  export interface IStylesCss {
    active: string;
    hidden: string;
    item: string;
    itemIcon: string;
    itemIcons: string;
    itemName: string;
    navBar: string;
    new: string;
    selected: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
