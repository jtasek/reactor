declare namespace StylesCssNamespace {
  export interface IStylesCss {
    condition: string;
    conditions: string;
    confirmation: string;
    dataView: string;
    field: string;
    inline: string;
    records: string;
    rule: string;
    ruleForm: string;
    valueEditor: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
