declare namespace StylesCssNamespace {
  export interface IStylesCss {
    activeZone: string;
    centerColumn: string;
    column: string;
    content: string;
    dock: string;
    dockZones: string;
    docked: string;
    dragPreview: string;
    dragSource: string;
    floating: string;
    grip: string;
    gripLeft: string;
    gripRight: string;
    grips: string;
    handle: string;
    leftColumn: string;
    panel: string;
    panelLayer: string;
    rightColumn: string;
    sideBarPanel: string;
    spacer: string;
    zone: string;
    zoneBottom: string;
    zoneBottomLeft: string;
    zoneBottomRight: string;
    zoneLeft: string;
    zoneRight: string;
    zoneTop: string;
    zoneTopLeft: string;
    zoneTopRight: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
