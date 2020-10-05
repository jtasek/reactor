import { Action, AsyncAction } from 'overmind';

export const showHomePage: Action = ({ state }) => {
  state.currentPage = 'home';
};
export const showLoginPage: Action = ({ state }) => {
  state.currentPage = 'login';
};

export const showResetPage: Action = ({ state }) => {
  state.currentPage = 'reset';
};

export const showSingupPage: AsyncAction = async ({ state, effects }) => {
  state.currentPage = 'signup';
};

export const showLogoutPage: AsyncAction = async ({ state, effects }) => {
  state.currentPage = 'logout';
};

export const showTermsPage: AsyncAction = async ({ state, effects }) => {
  state.currentPage = 'terms';
};
export const privacyPage: AsyncAction = async ({ state, effects }) => {
  state.currentPage = 'privacy';
};
export const exportPage: AsyncAction = async ({ state, effects }) => {
  state.currentPage = 'export';
};

export const importPage: AsyncAction = async ({ state, effects }) => {
  state.currentPage = 'import';
};

export const aboutPage: AsyncAction = async ({ state, effects }) => {
  state.currentPage = 'about';
};
