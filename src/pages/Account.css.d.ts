declare namespace AccountCssNamespace {
  export interface IAccountCss {
    actions: string;
    agreement: string;
    brand: string;
    card: string;
    content: string;
    fields: string;
    form: string;
    identity: string;
    legal: string;
    local: string;
    modes: string;
    page: string;
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
