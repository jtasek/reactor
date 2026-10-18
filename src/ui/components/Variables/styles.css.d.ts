declare namespace StylesCssNamespace {
  export interface IStylesCss {
    colorValue: string;
    confirm: string;
    create: string;
    dimension: string;
    dimensions: string;
    empty: string;
    field: string;
    fieldLabel: string;
    group: string;
    groupName: string;
    metadata: string;
    note: string;
    problem: string;
    resolution: string;
    row: string;
    rowHeader: string;
    source: string;
    swatch: string;
    variables: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
