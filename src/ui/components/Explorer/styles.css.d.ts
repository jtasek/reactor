declare namespace StylesCssNamespace {
  export interface IStylesCss {
    active: string;
    component: string;
    dropTarget: string;
    editing: string;
    empty: string;
    explorer: string;
    grip: string;
    hidden: string;
    icon: string;
    inlineMenu: string;
    itemName: string;
    itemText: string;
    label: string;
    layer: string;
    name: string;
    root: string;
    rootAction: string;
    row: string;
    selected: string;
    showAll: string;
    shown: string;
    toggle: string;
    toggleSpacer: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
