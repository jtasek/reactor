declare namespace TemplatesCssNamespace {
  export interface ITemplatesCss {
    card: string;
    dialog: string;
    grid: string;
    header: string;
  }
}

declare const TemplatesCssModule: TemplatesCssNamespace.ITemplatesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: TemplatesCssNamespace.ITemplatesCss;
};

export = TemplatesCssModule;
