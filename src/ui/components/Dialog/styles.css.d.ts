declare namespace StylesCssNamespace {
  export interface IStylesCss {
    action: string;
    actions: string;
    close: string;
    default: string;
    dialog: string;
    disabled: string;
    'modal-enter': string;
    'modal-enter-active': string;
    'modal-leave': string;
    'modal-leave-active': string;
    primary: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
