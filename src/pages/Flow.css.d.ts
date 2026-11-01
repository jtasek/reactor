declare namespace FlowCssNamespace {
    export interface IFlowCss {
        board: string;
        connections: string;
        diagram: string;
        flow: string;
        handle: string;
        screen: string;
        workspace: string;
    }
}

declare const FlowCssModule: FlowCssNamespace.IFlowCss & {
    /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
    locals: FlowCssNamespace.IFlowCss;
};

export = FlowCssModule;
