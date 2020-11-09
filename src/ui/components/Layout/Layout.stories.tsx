import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { Layout } from './Layout';

export default {
  title: 'Example/Layout',
  component: Layout
} as Meta;

const Template: Story = (args) => <Layout {...args} />;

export const Default = Template.bind({});
