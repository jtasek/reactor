import { Document, Renderer } from '../types';

export class CanvasRenderer implements Renderer {
  render(document: Document): void {
    throw new Error('Render not implemented');
  }
}
