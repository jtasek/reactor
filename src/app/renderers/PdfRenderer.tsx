import { Document, Renderer } from '../types';

export class PdfRenderer implements Renderer {
  render(document: Document): void {
    throw new Error('Render not implemented');
  }
}
