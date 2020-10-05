import { Document, Renderer } from '../types';

export class XmlRenderer implements Renderer {
  render(document: Document): void {
    throw new Error('Render not implemented');
  }
}
