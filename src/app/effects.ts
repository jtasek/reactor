import page from 'page';
export { v4 as newId } from 'uuid';

export { execute } from './services/commandInterpreter';

export { loadState, saveState } from './services/localStorage';

// We allow void type which is used to define "no params"
type IParams = {
  [param: string]: string;
} | void;

export function registerRouters(routes: { [url: string]: (params: IParams) => void }): void {
  Object.keys(routes).forEach((url) => {
    page(url, ({ params }) => routes[url](params));
  });

  page.start();
}

export function open(url: string): void {
  page.show(url);
}
