declare namespace TagsCssNamespace {
  export interface ITagsCss {
    add: string;
    check: string;
    create: string;
    editor: string;
    empty: string;
    heading: string;
    more: string;
    option: string;
    optionRow: string;
    options: string;
    picker: string;
    pill: string;
    search: string;
    tags: string;
    toneButton: string;
    toneSwatch: string;
    tones: string;
  }
}

declare const TagsCssModule: TagsCssNamespace.ITagsCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: TagsCssNamespace.ITagsCss;
};

export = TagsCssModule;
