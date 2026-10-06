const { diffOf, pageUpdate } = require('../src/diff');

const PAGE = [
  'Page: /todos',
  'Title: Todos',
  '',
  '- heading "Todos" [level=1]',
  '- textbox "New todo"',
  '- button "Add"',
  '- list "Todos":',
  '  - listitem: Buy milk',
  '- status: 1 of 1 left',
].join('\n');

describe('page diffs', () => {
  it('gives the lines that came and went, with two around each change', () => {
    const after = PAGE.replace('  - listitem: Buy milk', '  - listitem: Buy milk\n  - listitem: Walk the dog').replace(
      '1 of 1 left',
      '2 of 2 left'
    );
    expect(diffOf(PAGE, after).text).toBe(
      [
        '  ...',
        '  - list "Todos":',
        '    - listitem: Buy milk',
        '- - status: 1 of 1 left',
        '+   - listitem: Walk the dog',
        '+ - status: 2 of 2 left',
      ].join('\n')
    );
  });

  it('says nothing changed, and gives the whole page when most of it did', () => {
    expect(pageUpdate(PAGE, PAGE)).toEqual({ whole: false, text: '(nothing changed)' });
    const other = 'Page: /settings\nTitle: Settings\n\n- heading "Settings" [level=1]\n- checkbox "Dark mode"';
    expect(pageUpdate(PAGE, other)).toEqual({ whole: true, text: other });
    expect(pageUpdate(null, PAGE)).toEqual({ whole: true, text: PAGE });
  });
});
