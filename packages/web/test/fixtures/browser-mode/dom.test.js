import { describe, it, expect } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import './style.css';

describe('in a browser page', () => {
  it('lays out with the page styles', () => {
    document.body.innerHTML = '<div class="card">Card</div>';
    expect(document.querySelector('.card').getBoundingClientRect().width).toBe(220);
    expect(navigator.userAgent).toMatch(/Chrome/);
  });

  it('types and clicks as a user, found by role', async () => {
    document.body.innerHTML = `
      <label for="name">Name</label><input id="name" />
      <button>Greet</button>
      <p role="status"></p>`;
    document.querySelector('button').addEventListener('click', () => {
      setTimeout(() => {
        document.querySelector('[role="status"]').textContent = `Hello, ${document.querySelector('input').value}`;
      }, 100);
    });
    await userEvent.fill(page.getByRole('textbox', { name: 'Name' }), 'Ann');
    await page.getByRole('button', { name: 'Greet' }).click();
    await expect.element(page.getByRole('status')).toHaveTextContent('Hello, Ann');
    await expect.element(page.getByText('Greet')).toBeVisible();
    expect(page.getByRole('textbox').element()).toHaveValue('Ann');
  });

  it('keeps console output with the test', () => {
    console.log('from the page');
    expect(document.title).toBe('vyntra');
  });
});
