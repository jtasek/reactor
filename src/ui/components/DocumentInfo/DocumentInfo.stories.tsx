import React from 'react';
// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Story, Meta } from '@storybook/react/types-6-0';

import { DocumentInfo, Props } from './DocumentInfo';
import { createDocument } from 'src/app/factories';

export default {
  title: 'Example/DocumentInfo',
  component: DocumentInfo
} as Meta;

const Template: Story<Props> = (args) => <DocumentInfo {...args} />;

export const Default = Template.bind({});
Default.args = {
  document: createDocument()
};
