declare namespace StylesCssNamespace {
    export interface IStylesCss {
        blank: string;
        guide: string;
        hidden: string;
        mark: string;
        start: string;
        template: string;
        templates: string;
    }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
    /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
    locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
