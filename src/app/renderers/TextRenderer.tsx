import { Document, Renderer } from '../types';

export class TextRenderer implements Renderer {
  render(document: Document): void {
    throw new Error('Render not implemented');
  }
}
