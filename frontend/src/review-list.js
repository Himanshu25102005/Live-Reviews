const compareTitles = new Intl.Collator(undefined, { sensitivity: 'accent' }).compare;

function newestFirst(left, right) {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id.localeCompare(left.id);
}

const sortReviews = {
  newest: newestFirst,
  oldest: (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt) || newestFirst(left, right),
  titleAsc: (left, right) => compareTitles(left.title, right.title) || newestFirst(left, right),
  titleDesc: (left, right) => compareTitles(right.title, left.title) || newestFirst(left, right),
};

export function selectReviews(reviews, search, sort) {
  const query = search.trim().toLowerCase();
  const matches = query
    ? reviews.filter(({ title, content }) => title.toLowerCase().includes(query) || content.toLowerCase().includes(query))
    : [...reviews];
  return matches.sort(sortReviews[sort]);
}
