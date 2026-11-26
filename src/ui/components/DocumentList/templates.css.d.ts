declare namespace TemplatesCssNamespace {
  export interface ITemplatesCss {
    card: string;
    description: string;
    empty: string;
    footer: string;
    grid: string;
    heading: string;
    item: string;
    itemActions: string;
    picture: string;
    search: string;
    text: string;
    use: string;
  }
}

declare const TemplatesCssModule: TemplatesCssNamespace.ITemplatesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: TemplatesCssNamespace.ITemplatesCss;
};

export = TemplatesCssModule;
