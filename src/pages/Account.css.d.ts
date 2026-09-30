declare namespace AccountCssNamespace {
    export interface IAccountCss {
        account: string;
        form: string;
        link: string;
        modes: string;
    }
}

declare const AccountCssModule: AccountCssNamespace.IAccountCss & {
    /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
    locals: AccountCssNamespace.IAccountCss;
};

export = AccountCssModule;
