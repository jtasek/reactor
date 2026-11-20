declare namespace AccessibilityCheckCssNamespace {
  export interface IAccessibilityCheckCss {
    actions: string;
    check: string;
    covered: string;
    failed: string;
    fix: string;
    footer: string;
    issues: string;
    review: string;
    summary: string;
    where: string;
  }
}

declare const AccessibilityCheckCssModule: AccessibilityCheckCssNamespace.IAccessibilityCheckCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: AccessibilityCheckCssNamespace.IAccessibilityCheckCss;
};

export = AccessibilityCheckCssModule;
