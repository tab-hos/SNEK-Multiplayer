/**
 * Creates a page URL for navigation
 * @param {string} pageName - Name of the page
 * @returns {string} URL path
 */
export function createPageUrl(pageName) {
  const routes = {
    'Home': '/',
    'Game': '/game',
  };
  return routes[pageName] || '/';
}

