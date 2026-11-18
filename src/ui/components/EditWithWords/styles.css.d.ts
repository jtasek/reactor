declare namespace StylesCssNamespace {
  export interface IStylesCss {
    actions: string;
    applied: string;
    bar: string;
    barHeader: string;
    barIcon: string;
    barPrompt: string;
    button: string;
    card: string;
    cardTitle: string;
    changeDot: string;
    chat: string;
    chip: string;
    conversation: string;
    disclosure: string;
    dots: string;
    empty: string;
    example: string;
    expandedArtwork: string;
    field: string;
    fieldControls: string;
    form: string;
    ghost: string;
    hint: string;
    iconButton: string;
    link: string;
    localDot: string;
    message: string;
    operationKind: string;
    operations: string;
    outcome: string;
    preview: string;
    previewArtwork: string;
    problem: string;
    prompt: string;
    promptBox: string;
    pulse: string;
    records: string;
    reply: string;
    send: string;
    suggestions: string;
    toolbar: string;
    topics: string;
    turn: string;
    userMessage: string;
    visuallyHidden: string;
    words: string;
    wordsTitle: string;
    working: string;
  }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
