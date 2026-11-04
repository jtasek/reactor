export const STARTER_TEMPLATES = [
    {
        id: 'inspector-typography',
        name: 'Inspector typography',
        description: 'Compare heading styles with interactive component variants.'
    },
    {
        id: 'list-detail',
        name: 'List / detail',
        description: 'Browse projects, open a detail and recover from an empty list.'
    },
    {
        id: 'forms',
        name: 'Forms',
        description: 'Start a request, fill in a form and review a confirmation.'
    },
    {
        id: 'sign-in',
        name: 'Sign-in',
        description: 'Try an email sign-in journey, check-email step and empty account.'
    },
    {
        id: 'settings',
        name: 'Settings',
        description: 'Edit a profile, review a saved state and manage connections.'
    }
] as const;

export type StarterTemplateId = (typeof STARTER_TEMPLATES)[number]['id'];
