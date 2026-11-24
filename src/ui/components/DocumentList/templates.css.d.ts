declare namespace TemplatesCssNamespace {
  export interface ITemplatesCss {
    card: string;
    grid: string;
    picture: string;
  }
}

declare const TemplatesCssModule: TemplatesCssNamespace.ITemplatesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: TemplatesCssNamespace.ITemplatesCss;
};

export = TemplatesCssModule;
