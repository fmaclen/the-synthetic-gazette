import { expect, test } from '@playwright/test';

import { TEST_USERS, pocketbaseVerifyUser } from './fixtures/helpers.js';

test.describe('Users', () => {
	test('can join', async ({ page }) => {
		const notice = page.locator('div.notice');

		await page.goto('/');
		expect(await notice.textContent()).toBe('Generated by AI, curated by humans');

		await page.click('button[aria-label="Toggle navigation"]');
		await page.getByText('Join to play').click();
		await expect(page.locator('h1', { hasText: 'Join to play' })).toBeVisible();
		expect(await notice.textContent()).toBe('Already have an account? Login');

		const submitButton = page.locator('button[type=submit]', { hasText: 'Join' });
		await expect(submitButton).toBeDisabled();

		await page.getByLabel('E-mail').fill(TEST_USERS.alice.email);
		await page.getByLabel('Nickname').fill(TEST_USERS.alice.nickname);
		await page.getByLabel('Password', { exact: true }).fill(TEST_USERS.alice.password);
		await page.getByLabel('Confirm password').fill(TEST_USERS.alice.password);
		await page.getByLabel('I agree to the terms of service and privacy policy').check();
		await expect(submitButton).not.toBeDisabled();

		await submitButton.click();
		await expect(page.getByText('Almost there...')).toBeVisible();
		await expect(notice).toContainText(['Check your email to verify your account']);
	});

	test('can login', async ({ page }) => {
		const notice = page.locator('div.notice');

		await page.goto('/');
		await page.click('button[aria-label="Toggle navigation"]');

		// Test logged out navigation
		await expect(page.getByText('Join to play')).toBeVisible();
		await expect(page.getByText('Login')).toBeVisible();
		await expect(page.getByText('Alice')).not.toBeVisible();
		await expect(page.getByText('Drafts')).not.toBeVisible();
		await expect(page.getByText('Logout')).not.toBeVisible();

		await page.getByText('Login').click();
		await expect(page.locator('h1', { hasText: 'Login' })).toBeVisible();
		expect(await notice.textContent()).toBe("Don't have an account? Join to play");

		const submitButton = page.locator('button[type=submit]', { hasText: 'Login' });
		await expect(submitButton).toBeDisabled();

		await page.getByLabel('E-mail').fill(TEST_USERS.alice.email);
		await page.getByLabel('Password', { exact: true }).fill(TEST_USERS.alice.password);
		await expect(submitButton).not.toBeDisabled();

		await submitButton.click();
		await expect(notice).toContainText(["Can't login, check your credentials"]);

		await pocketbaseVerifyUser(TEST_USERS.alice.email);

		await page.getByLabel('Password', { exact: true }).fill(TEST_USERS.alice.password);
		await submitButton.click();
		await expect(notice).not.toContainText(["Can't login, check your credentials"]);

		await expect(page.locator('a.categories__a', { hasText: 'Politics' })).toBeVisible();
		expect(await notice.textContent()).toBe('Generated by AI, curated by humans');

		await page.click('button[aria-label="Toggle navigation"]');

		// Test logged in navigation
		await expect(page.getByText('Alice')).toBeVisible();
		await expect(page.getByText('Drafts')).toBeVisible();
		await expect(page.getByText('Logout')).toBeVisible();
		await expect(page.getByText('Join to play')).not.toBeVisible();
		await expect(page.getByText('Login')).not.toBeVisible();
	});
});
