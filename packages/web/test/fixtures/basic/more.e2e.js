test('matchers retry, and .not waits for the opposite', async ({ page }) => {
  await page.setContent('<button disabled>Save</button><p hidden>Saved</p><input type="checkbox">');
  await page.evaluate(() => {
    setTimeout(() => {
      document.querySelector('button').disabled = false;
      document.querySelector('p').hidden = false;
    }, 200);
  });
  await expect(page.getByRole('button')).toBeEnabled();
  await expect(page.getByText('Saved')).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByRole('button')).toHaveAttribute('disabled', { timeout: 300 }).catch((error) => {
    expect(error.message).toContain('Received: no disabled');
  });
  await expect(page).toHaveURL('about:blank');
});

test('says what it takes', async ({ page }) => {
  await expect(expect(42).toBeVisible()).rejects.toThrow('toBeVisible takes a Playwright locator, not number');
  await expect(expect(page.getByRole('button')).toBeVisible({ timeout: 200 })).rejects.toThrow(
    "Locator: getByRole('button')\nReceived: not visible\n\nWaited 200ms."
  );
});
