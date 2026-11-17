// Les listes qui grandissent avec le temps se lisent par pages : jamais toute la table d'un coup
export const PAR_PAGE = 50;

export function pagination(page = 1, parPage = PAR_PAGE) {
  return { skip: (page - 1) * parPage, take: parPage };
}

// Les informations de page renvoyées avec la liste
export function infosPage(page: number, total: number, parPage = PAR_PAGE) {
  return { page, parPage, total, pages: Math.ceil(total / parPage) };
}
