export interface LegalSection {
    heading: string;
    paragraphs: string[];
}

export interface LegalText {
    title: string;
    sections: LegalSection[];
}

export const TERMS: LegalText = {
    title: 'Terms of use',
    sections: [
        {
            heading: 'The beta',
            paragraphs: [
                'Reactor is in public beta. Features change, and the service may be slow, unavailable or lose work. Keep your own copies of anything you cannot afford to lose; Download on the Prototype page saves a prototype as one file.',
                'The service is offered as it is, without any warranty, and we are not liable for lost work or other damage from using it, as far as the law allows.'
            ]
        },
        {
            heading: 'Your account',
            paragraphs: [
                'You need to be at least 16 to create an account. Keep your password to yourself; you are responsible for what is done with your account.',
                'You can delete your account at any time on the Account page.'
            ]
        },
        {
            heading: 'Your content',
            paragraphs: [
                'Documents, images and prototypes you make stay yours. You let us store, copy and show them only as the service needs to: to sync them, keep their history, show them to the people you share them with, and send them to an AI provider when you use AI.',
                'Only add content you have the right to use. Do not use Reactor to break the law, to harm others, to send spam or malware, or to get around its limits or other people’s access.'
            ]
        },
        {
            heading: 'Sharing',
            paragraphs: [
                'Anyone who has a shared prototype link can open that prototype. Turn a link off in the Share dialog to stop it working.'
            ]
        },
        {
            heading: 'Ending and changes',
            paragraphs: [
                'We may suspend an account that breaks these terms. We may change these terms; the date at the top changes with them, and we will tell you before a change that matters takes effect.'
            ]
        }
    ]
};

export const PRIVACY: LegalText = {
    title: 'Privacy policy',
    sections: [
        {
            heading: 'What we keep',
            paragraphs: [
                'Your account: your name, email address, a hash of your password if you set one, and your photo when you sign in with Google or GitHub.',
                'Your sign-ins: each session keeps the IP address and the browser it was started from, until it ends or you sign out.',
                'Your work: the documents, images and history of your workspaces, the shared prototype links you make, and the workspaces you belong to and invitations you send.',
                'Use of the service: when a shared prototype is opened, a random identifier the browser keeps for that prototype site, and the time. We count these each week to see whether prototypes get used. When the editor fails, it sends us the error message, the page and the app version, which we keep in the server log.',
                'Feedback you send from the editor: your message, the page you sent it from and the app version, with your account, so we can answer you.'
            ]
        },
        {
            heading: 'How we use it',
            paragraphs: [
                'Only to run Reactor: to sign you in, sync and keep your documents, send you the emails you ask for (confirming your address, sign-in links, password resets, invitations), and improve the service. We do not sell your data or show you ads.'
            ]
        },
        {
            heading: 'AI',
            paragraphs: [
                'When you use an AI feature, what it needs from your document, such as the selected shapes, variables and records, is sent with your request to the AI provider the server is set up with (Anthropic or OpenAI). Workspace admins can turn AI off for their workspace.'
            ]
        },
        {
            heading: 'Who else sees it',
            paragraphs: [
                'The members of your workspaces see its documents, and anyone with a shared link sees that prototype. Beyond them, only the providers that host the service, send its email and answer its AI requests handle your data, for those purposes.'
            ]
        },
        {
            heading: 'How long we keep it',
            paragraphs: [
                'As long as your account exists. A document’s history keeps snapshots for 30 days. Deleting your account deletes your Personal workspace with its documents, history, images and shared links; documents you made in other workspaces stay there.'
            ]
        },
        {
            heading: 'Cookies and this browser',
            paragraphs: [
                'Reactor sets one cookie to keep you signed in. It keeps your documents and panel layout in this browser so that they open without the network; signing out removes your documents from it.'
            ]
        },
        {
            heading: 'Your rights',
            paragraphs: [
                'You can see your account on the Account page and delete it there, and download your prototypes from the Prototype page. For anything else about your data, write to us at the address the Reactor emails come from.'
            ]
        }
    ]
};
