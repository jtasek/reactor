import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { LoginBox } from '.';

export default {
  title: 'Example/LoginBox',
  component: LoginBox,
  argTypes: {
    backgroundColor: { control: 'color' }
  }
} as Meta;

const Template: Story = (args) => <LoginBox {...args} />;

export const Default = Template.bind({});
