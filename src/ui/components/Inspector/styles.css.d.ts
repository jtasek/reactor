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
    exposureStatus: string;
    heading: string;
    iconButton: string;
    inspector: string;
    instanceChild: string;
    instanceColor: string;
    instanceEmpty: string;
    instanceFields: string;
    instanceFooter: string;
    instanceIdentity: string;
    instanceInspector: string;
    instanceName: string;
    instanceOptions: string;
    instanceProps: string;
    instanceReset: string;
    instanceRow: string;
    instanceSectionHeading: string;
    instanceStatus: string;
    instanceTitle: string;
    instanceValue: string;
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
