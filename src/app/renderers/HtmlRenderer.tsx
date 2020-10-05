import { Document, Renderer } from '../types';

export class HtmlRenderer implements Renderer {
  render(document: Document): void {
    throw new Error('Render not implemented');
  }
}
