declare namespace StylesCssNamespace {
  export interface IStylesCss {
    attention: string;
    checkbox: string;
    columnName: string;
    commandBar: string;
    compactPicker: string;
    condition: string;
    conditions: string;
    confirmation: string;
    count: string;
    dataView: string;
    destructive: string;
    detail: string;
    emptyState: string;
    field: string;
    fieldDetail: string;
    fieldLine: string;
    formActions: string;
    formField: string;
    group: string;
    hint: string;
    iconButton: string;
    inline: string;
    item: string;
    itemList: string;
    listHeading: string;
    message: string;
    newEntity: string;
    newField: string;
    optionsEditor: string;
    panelToolbar: string;
    plain: string;
    primary: string;
    records: string;
    required: string;
    rowActions: string;
    rowNumber: string;
    rule: string;
    ruleForm: string;
    setting: string;
    sidebar: string;
    tabPanel: string;
    tableEmpty: string;
    tabs: string;
    typeIcon: string;
    typeSelect: string;
    utilities: string;
    valueEditor: string;
    visuallyHidden: string;
    wide: string;
    workspace: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
