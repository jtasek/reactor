declare namespace AccessibilityCheckCssNamespace {
  export interface IAccessibilityCheckCss {
    actions: string;
    covered: string;
    fix: string;
    fixable: string;
    footer: string;
    issueText: string;
    issues: string;
    kind: string;
    message: string;
    note: string;
    priority: string;
    review: string;
    sample: string;
    show: string;
    summary: string;
    tags: string;
    where: string;
  }
}

declare const AccessibilityCheckCssModule: AccessibilityCheckCssNamespace.IAccessibilityCheckCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: AccessibilityCheckCssNamespace.IAccessibilityCheckCss;
};

export = AccessibilityCheckCssModule;
