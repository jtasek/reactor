declare namespace StylesCssNamespace {
    export interface IStylesCss {
        confirm: string;
        create: string;
        empty: string;
        group: string;
        groupName: string;
        problem: string;
        row: string;
        uses: string;
        variables: string;
    }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
    /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
    locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
