declare namespace StylesCssNamespace {
  export interface IStylesCss {
    align: string;
    alignRow: string;
    bound: string;
    color: string;
    componentDetails: string;
    componentHeading: string;
    componentHint: string;
    componentPreview: string;
    componentProps: string;
    exposeButton: string;
    exposureStatus: string;
    headerActions: string;
    headerBinding: string;
    headerIdentity: string;
    headerMenu: string;
    headerMenuContents: string;
    headerName: string;
    headerSourceName: string;
    heading: string;
    iconButton: string;
    inspector: string;
    inspectorHeader: string;
    instanceChild: string;
    instanceColor: string;
    instanceEmpty: string;
    instanceFields: string;
    instanceInspector: string;
    instanceOptions: string;
    instanceProps: string;
    instanceReset: string;
    instanceRow: string;
    instanceSectionHeading: string;
    instanceStatus: string;
    instanceValue: string;
    note: string;
    sourceChildBreadcrumb: string;
    variablePicker: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
