// The tests of a file a run selects by their names and tags: -t / --grep (the full name matches),
// --grep-invert (it does not), --tag (one of the tags, inherited from the enclosing describe blocks), --exclude-tag
// (none of them). Returns a predicate, or null when nothing is filtered.
const listOf = (value) =>
  [value ?? []]
    .flat()
    .flatMap((item) => String(item).split(','))
    .map((tag) => tag.trim())
    .filter(Boolean);

function nameAndTagFilter(config) {
  const pattern = config.testNamePattern ? new RegExp(config.testNamePattern, 'i') : null;
  const inverted = config.grepInvert ? new RegExp(config.grepInvert, 'i') : null;
  const wanted = listOf(config.tags);
  const unwanted = listOf(config.excludeTags);
  if (!pattern && !inverted && wanted.length === 0 && unwanted.length === 0) {
    return null;
  }
  return (test) =>
    (!pattern || pattern.test(test.fullName)) &&
    (!inverted || !inverted.test(test.fullName)) &&
    (wanted.length === 0 || wanted.some((tag) => test.tags.includes(tag))) &&
    !unwanted.some((tag) => test.tags.includes(tag));
}

module.exports = { nameAndTagFilter, listOf };
