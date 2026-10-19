declare namespace AccountCssNamespace {
  export interface IAccountCss {
    brand: string;
    card: string;
    content: string;
    fields: string;
    form: string;
    identity: string;
    link: string;
    local: string;
    modes: string;
    page: string;
    primary: string;
    secondary: string;
    signOut: string;
    social: string;
  }
}

declare const AccountCssModule: AccountCssNamespace.IAccountCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: AccountCssNamespace.IAccountCss;
};

export = AccountCssModule;
