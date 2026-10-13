declare namespace FiltersCssNamespace {
    export interface IFiltersCss {
        check: string;
        filterMenu: string;
    }
}

declare const FiltersCssModule: FiltersCssNamespace.IFiltersCss & {
    /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
    locals: FiltersCssNamespace.IFiltersCss;
};

export = FiltersCssModule;
