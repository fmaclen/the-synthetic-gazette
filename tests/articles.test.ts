import { expect, test } from '@playwright/test';

import { ArticleStatus } from '../src/lib/article.js';
import { MOCK_ARTICLES } from '../src/lib/tests.js';
import {
	MOCK_USERS,
	createArticle,
	createUser,
	getLastArticle,
	getUser,
	loginUser,
	resetDatabase,
	verifyUser
} from './helpers/fixtures.js';

test.describe('Articles', () => {
	test.beforeAll(async () => {
		await resetDatabase();
	});

	test('No articles to browse', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByText('Generated by AI, curated by humans')).toBeVisible();
		await expect(page.getByText('Service is currently unavailable, please try again later')).toBeVisible(); // prettier-ignore

		await page.getByText('Politics').click();
		await expect(page.getByText('Service is currently unavailable, please try again later')).not.toBeVisible(); // prettier-ignore
		await expect(page.getByText('There are no articles in the Politics category, try creating one')).toBeVisible(); // prettier-ignore
	});

	test.describe('With articles', () => {
		test.beforeAll(async () => {
			const users = [MOCK_USERS.alice, MOCK_USERS.bob];

			for (const user of users) {
				await createUser(user);
				await verifyUser(user.email);
			}

			let user = await getUser(MOCK_USERS.alice.email);
			if (user) {
				await createArticle(MOCK_ARTICLES[0], ArticleStatus.DRAFT, user.id);
				await createArticle(MOCK_ARTICLES[1], ArticleStatus.PUBLISHED, user.id);
			}

			user = await getUser(MOCK_USERS.bob.email);
			if (user) {
				await createArticle(MOCK_ARTICLES[2], ArticleStatus.DRAFT, user.id);
				await createArticle(MOCK_ARTICLES[3], ArticleStatus.PUBLISHED, user.id);
			}
		});

		test.beforeEach(async ({ page }) => {
			await loginUser(MOCK_USERS.alice, page);
		});

		test('Can browse article summaries', async ({ page }) => {
			// Homepage

			// Article by Alice
			await expect(page.getByText(MOCK_USERS.alice.nickname)).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[1].headline)).toBeVisible();
			await expect(page.locator('h3.article__category', { hasText: MOCK_ARTICLES[1].category })).toBeVisible(); // prettier-ignore
			await expect(page.getByText(MOCK_ARTICLES[1].body[0])).toBeVisible(); // Summary
			await expect(page.getByText(MOCK_ARTICLES[1].body[1])).not.toBeVisible();

			// Article by Bob
			await expect(page.getByText(MOCK_USERS.bob.nickname)).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].headline)).toBeVisible();
			await expect(page.locator('h3.article__category', { hasText: MOCK_ARTICLES[3].category })).toBeVisible(); // prettier-ignore
			await expect(page.getByText(MOCK_ARTICLES[3].body[0])).toBeVisible(); // Summary
			await expect(page.getByText(MOCK_ARTICLES[3].body[1])).not.toBeVisible();

			// Category page
			await page.locator('a.categories__a', { hasText: MOCK_ARTICLES[1].category }).click();
			await expect(
				page.locator(`a.categories__a--${MOCK_ARTICLES[1].category.toLowerCase()}`)
			).toHaveClass(/categories__a--active/);
			await expect(page.locator('h3.article__category', { hasText: MOCK_ARTICLES[1].category })).toBeVisible(); // prettier-ignore
			await expect(page.getByText(MOCK_USERS.alice.nickname)).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[1].headline)).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[1].body[0])).toBeVisible(); // Summary
			await expect(page.getByText(MOCK_ARTICLES[1].body[1])).not.toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].headline)).not.toBeVisible();
		});

		test('Can read all published articles, can read drafts when user is author', async ({ page }) => {
			// Homepage

			// Published articles
			await expect(page.getByText(MOCK_ARTICLES[1].headline)).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].headline)).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].body[0])).toBeVisible(); // Summary
			await expect(page.getByText(MOCK_ARTICLES[3].body[1])).not.toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].body[2])).not.toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].prompt)).not.toBeVisible();

			// Draft articles
			await expect(page.getByText(MOCK_ARTICLES[0].headline)).not.toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[2].headline)).not.toBeVisible();

			// Published article page by Bob
			await page.getByText(MOCK_ARTICLES[3].headline).click();
			await expect(
				page.locator('h1.article__headline', { hasText: MOCK_ARTICLES[3].headline })
			).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].body[0])).toBeVisible(); // Summary
			await expect(page.getByText(MOCK_ARTICLES[3].body[1])).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].body[2])).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].prompt)).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[1].headline)).not.toBeVisible();

			// Drafts by Alice
			let user = await getUser(MOCK_USERS.alice.email);
			let article = await getLastArticle(
				`status = "${ArticleStatus.DRAFT}" && user = "${user?.id}"`
			);
			expect(article.headline).toBe(MOCK_ARTICLES[0].headline);

			await page.goto(`/article/${article.id}`);
			await expect(
				page.locator('h1.article__headline', { hasText: MOCK_ARTICLES[0].headline })
			).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[0].body[0])).toBeVisible(); // Summary
			await expect(page.getByText(MOCK_ARTICLES[0].body[1])).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[0].body[2])).toBeVisible();

			// A draft by Bob can't be viewed by Alice
			user = await getUser(MOCK_USERS.bob.email);
			article = await getLastArticle(`status = "${ArticleStatus.DRAFT}" && user = "${user?.id}"`);
			expect(article.headline).toBe(MOCK_ARTICLES[2].headline);

			await page.goto(`/article/${article.id}`);
			await expect(page.getByText('Error 404')).toBeVisible();
			await expect(page.getByText('Not found')).toBeVisible();
		});

		test.skip('Can react to articles', async ({ page }) => {
			//
		});

		test.skip("Can delete user's own articles", async ({ page }) => {
			//
		});

		test.skip("Can't access other user's draft articles", async ({ page }) => {
			//
		});
	});
});
