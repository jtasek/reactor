declare namespace StylesCssNamespace {
  export interface IStylesCss {
    align: string;
    alignRow: string;
    bound: string;
    caption: string;
    color: string;
    componentDetails: string;
    componentHeading: string;
    componentHint: string;
    componentPreview: string;
    componentProps: string;
    dataList: string;
    eachSide: string;
    exposeButton: string;
    exposureStatus: string;
    footnote: string;
    frameHint: string;
    headerActions: string;
    headerBinding: string;
    headerIdentity: string;
    headerMenu: string;
    headerMenuContents: string;
    headerName: string;
    headerSourceName: string;
    heading: string;
    iconButton: string;
    iconSwitch: string;
    inspector: string;
    inspectorHeader: string;
    inspectorHelp: string;
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
    interactionField: string;
    interactions: string;
    labelColumn: string;
    layoutChoice: string;
    note: string;
    pair: string;
    propertyMapping: string;
    prototypeState: string;
    prototypeStateRow: string;
    responsiveField: string;
    responsiveRule: string;
    responsiveRules: string;
    segments: string;
    sourceChildBreadcrumb: string;
    space: string;
    spacing: string;
    spacingLabel: string;
    stateAdd: string;
    stateRow: string;
    stateType: string;
    stateValue: string;
    subRow: string;
    variablePicker: string;
    variantActions: string;
    variantSummary: string;
    visuallyHidden: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
