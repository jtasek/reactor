import { Document, Renderer } from '../types';

export class HtmlRenderer implements Renderer {
  document: Document;
  render() {
    console.log(this.document.toString());

    this.document.shapes.forEach(function(value, index) {
      console.log(value.Name);
    });
  }
}
