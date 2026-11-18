declare namespace StylesCssNamespace {
  export interface IStylesCss {
    attention: string;
    badge: string;
    columnName: string;
    condition: string;
    conditions: string;
    confirmation: string;
    count: string;
    dataView: string;
    destructive: string;
    emptyState: string;
    entity: string;
    entityList: string;
    entityName: string;
    field: string;
    fieldDetail: string;
    fieldLine: string;
    formActions: string;
    group: string;
    hint: string;
    iconButton: string;
    inline: string;
    main: string;
    message: string;
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
    save: string;
    segments: string;
    setting: string;
    sidebar: string;
    sidebarTitle: string;
    spacer: string;
    tabPanel: string;
    tableEmpty: string;
    toggle: string;
    toolbar: string;
    typeIcon: string;
    typeSelect: string;
    valueEditor: string;
    visuallyHidden: string;
    wide: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
