import page from 'page';

export { v4 as newId } from 'uuid';
export { execute } from './services/commandInterpreter';
export { loadState, saveState } from './services/localStorage';

export const initializeRoutes = (routes) => {
  Object.keys(routes).forEach((url) => {
    page(url, ({ params }) => routes[url](params));
  });
  page.start();
};

export const navigate = (url: string) => {
  page.show(url);
};
