declare namespace StylesCssNamespace {
    export interface IStylesCss {
        actions: string;
        back: string;
        compactPicker: string;
        confirm: string;
        defaultChoice: string;
        detail: string;
        dimension: string;
        dimensions: string;
        editorFields: string;
        empty: string;
        field: string;
        fieldLabel: string;
        footer: string;
        formField: string;
        inheritedValue: string;
        item: string;
        itemList: string;
        itemMenu: string;
        listHeading: string;
        metadata: string;
        modeEdit: string;
        newItem: string;
        note: string;
        notice: string;
        primary: string;
        problem: string;
        quiet: string;
        resolution: string;
        row: string;
        rowHeader: string;
        secondary: string;
        section: string;
        sidebar: string;
        source: string;
        swatch: string;
        toolbar: string;
        valueInput: string;
        variables: string;
        workspace: string;
    }
}

declare const StylesCssModule: StylesCssNamespace.IStylesCss & {
    /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
    locals: StylesCssNamespace.IStylesCss;
};

export = StylesCssModule;
