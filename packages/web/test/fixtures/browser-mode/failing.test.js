test('fails where it is written', () => {
  document.body.innerHTML = '<p>Bye</p>';
  expect(document.querySelector('p').textContent).toBe('Hello');
});
