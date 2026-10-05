export default {
    plugins: ['stylelint-declaration-strict-value'],
    rules: {
        'scale-unlimited/declaration-strict-value': [
            ['/color$/', 'fill', 'stroke', 'background', 'box-shadow'],
            {
                ignoreFunctions: false,
                ignoreValues: ['currentColor', 'transparent', 'inherit', 'none', '/^color-mix\\(/']
            }
        ]
    }
};
