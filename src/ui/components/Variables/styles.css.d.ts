declare namespace StylesCssNamespace {
    export interface IStylesCss {
        actionMenu: string;
        actions: string;
        back: string;
        commandBar: string;
        compactPicker: string;
        defaultChoice: string;
        detail: string;
        dimension: string;
        dimensions: string;
        editorFields: string;
        empty: string;
        field: string;
        fieldLabel: string;
        formActions: string;
        formField: string;
        iconButton: string;
        item: string;
        itemList: string;
        listHeading: string;
        metadata: string;
        modeEdit: string;
        modeName: string;
        modeValue: string;
        modeValues: string;
        note: string;
        notice: string;
        options: string;
        panelToolbar: string;
        primary: string;
        problem: string;
        resolution: string;
        row: string;
        rowHeader: string;
        secondary: string;
        section: string;
        sectionHeading: string;
        settings: string;
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
