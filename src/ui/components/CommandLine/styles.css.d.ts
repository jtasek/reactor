declare namespace StylesCssNamespace {
  export interface IStylesCss {
    commandLine: string;
    content: string;
    context: string;
    editPreview: string;
    fields: string;
    footer: string;
    heading: string;
    message: string;
    primary: string;
    search: string;
    variablePicker: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
