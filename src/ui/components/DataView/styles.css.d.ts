declare namespace StylesCssNamespace {
  export interface IStylesCss {
    attention: string;
    card: string;
    cardAdd: string;
    cardField: string;
    cardHeader: string;
    checkbox: string;
    columnName: string;
    commandBar: string;
    condition: string;
    conditions: string;
    confirmation: string;
    count: string;
    dataView: string;
    destructive: string;
    drawer: string;
    drawerHeader: string;
    emptyState: string;
    field: string;
    fieldDetail: string;
    fieldLine: string;
    formActions: string;
    group: string;
    hint: string;
    iconButton: string;
    inline: string;
    links: string;
    listHeading: string;
    map: string;
    mapCanvas: string;
    mapSize: string;
    message: string;
    muted: string;
    newEntity: string;
    newField: string;
    optionsEditor: string;
    plain: string;
    primary: string;
    records: string;
    required: string;
    rowActions: string;
    rowNumber: string;
    rule: string;
    ruleForm: string;
    setting: string;
    spacer: string;
    tabPanel: string;
    tableEmpty: string;
    tabs: string;
    tree: string;
    treeField: string;
    treeItem: string;
    treeList: string;
    treeRow: string;
    twisty: string;
    typeIcon: string;
    typeSelect: string;
    valueEditor: string;
    visuallyHidden: string;
    wide: string;
    workArea: string;
    zoom: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
