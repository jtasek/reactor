declare namespace StylesCssNamespace {
  export interface IStylesCss {
    active: string;
    chip: string;
    chipSelected: string;
    chips: string;
    component: string;
    current: string;
    done: string;
    dropTarget: string;
    empty: string;
    explorer: string;
    filterButton: string;
    filterPill: string;
    header: string;
    hidden: string;
    itemName: string;
    label: string;
    layerButton: string;
    layerHint: string;
    layerManager: string;
    layerManagerTitle: string;
    layerName: string;
    layerRow: string;
    menuIconSpace: string;
    muted: string;
    name: string;
    newLayer: string;
    outline: string;
    rename: string;
    rest: string;
    row: string;
    section: string;
    sectionTitle: string;
    selected: string;
    status: string;
    statusButtons: string;
    toggle: string;
    toggleSpacer: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
