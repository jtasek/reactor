import page from 'page';
export { v4 as newId } from 'uuid';

export { execute } from './services/commandInterpreter';

export const router = {
  initialize(routes) {
    Object.keys(routes).forEach((url) => {
      page(url, ({ params }) => routes[url](params));
    });
    page.start();
  },
  goTo(url) {
    page.show(url);
  }
};
