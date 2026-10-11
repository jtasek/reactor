declare namespace StylesCssNamespace {
  export interface IStylesCss {
    align: string;
    alignRow: string;
    bound: string;
    color: string;
    componentDetails: string;
    componentHeading: string;
    componentHint: string;
    componentName: string;
    componentPreview: string;
    componentProps: string;
    exposeButton: string;
    heading: string;
    iconButton: string;
    inspector: string;
    instanceProps: string;
    instanceRow: string;
    note: string;
    sourceChildHeading: string;
    sourceLink: string;
    variablePicker: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
