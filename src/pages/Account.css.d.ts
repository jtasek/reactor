declare namespace AccountCssNamespace {
  export interface IAccountCss {
    agreement: string;
    brand: string;
    card: string;
    content: string;
    danger: string;
    fields: string;
    form: string;
    identity: string;
    legal: string;
    link: string;
    local: string;
    modes: string;
    page: string;
    primary: string;
    secondary: string;
    signOut: string;
    social: string;
    wide: string;
  }
}

declare const AccountCssModule: AccountCssNamespace.IAccountCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: AccountCssNamespace.IAccountCss;
};

export = AccountCssModule;
