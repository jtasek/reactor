declare namespace StylesCssNamespace {
  export interface IStylesCss {
    back: string;
    bar: string;
    barStatus: string;
    browseControls: string;
    card: string;
    cardFooter: string;
    cardHeader: string;
    cardTitle: string;
    clearFilters: string;
    current: string;
    dateFilter: string;
    deletedName: string;
    documentList: string;
    empty: string;
    filterSummary: string;
    grid: string;
    header: string;
    iconActions: string;
    iconButton: string;
    layoutToggle: string;
    meta: string;
    nameButton: string;
    nameInput: string;
    newButton: string;
    panel: string;
    resultCount: string;
    search: string;
    subtitle: string;
    tagFilter: string;
    thumbnail: string;
    thumbnailEmpty: string;
    thumbnailSvg: string;
    toast: string;
    toastRegion: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
