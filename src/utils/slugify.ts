const DIACRITIC_MARKS = /\p{M}/gu;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const SURROUNDING_DASHES = /^-+|-+$/g;

export const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replaceAll(DIACRITIC_MARKS, '')
    .toLowerCase()
    .replaceAll(NON_ALPHANUMERIC, '-')
    .replaceAll(SURROUNDING_DASHES, '');
