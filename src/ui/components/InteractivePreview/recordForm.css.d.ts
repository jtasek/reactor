declare namespace RecordFormCssNamespace {
  export interface IRecordFormCss {
    field: string;
    form: string;
  }
}

declare const RecordFormCssModule: RecordFormCssNamespace.IRecordFormCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: RecordFormCssNamespace.IRecordFormCss;
};

export = RecordFormCssModule;
