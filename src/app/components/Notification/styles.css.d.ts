declare namespace StylesCssNamespace {
  export interface IStylesCss {
    action: string;
    dismiss: string;
    error: string;
    icon: string;
    info: string;
    message: string;
    notification: string;
    notifications: string;
    success: string;
    warning: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
