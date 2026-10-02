declare namespace NotificationCssNamespace {
    export interface INotificationCss {
        action: string;
        dismiss: string;
        error: string;
        icon: string;
        info: string;
        message: string;
        notification: string;
        notifications: string;
        success: string;
        warning: string;
    }
}

declare const NotificationCssModule: NotificationCssNamespace.INotificationCss & {
    /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
    locals: NotificationCssNamespace.INotificationCss;
};

export = NotificationCssModule;
