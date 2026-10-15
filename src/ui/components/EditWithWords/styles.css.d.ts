declare namespace StylesCssNamespace {
  export interface IStylesCss {
    actions: string;
    chat: string;
    conversation: string;
    form: string;
    message: string;
    operations: string;
    problem: string;
    prompt: string;
    proposal: string;
    speaker: string;
    status: string;
    toolbar: string;
    turn: string;
    userMessage: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
