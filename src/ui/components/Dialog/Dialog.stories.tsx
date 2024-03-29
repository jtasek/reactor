import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { Dialog, Props } from './Dialog';

export default {
  title: 'Example/Dialog',
  component: Dialog
} as Meta;

const Template: Story<Props> = (args) => <Dialog {...args} />;

export const Default = Template.bind({});
Default.args = {};
