import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';

import { ArticleStatus } from '../src/lib/article.js';
import { MOCK_ARTICLES } from '../src/lib/tests.js';
import { MOCK_USERS } from './lib/fixtures.js';
import {
	createArticle,
	createUser,
	getLastArticle,
	getUser,
	loginUser,
	prepareToAcceptDialog,
	resetDatabase,
	updateArticle,
	verifyUser
} from './lib/helpers.js';

async function seedTest() {
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
}

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
			await seedTest();
		});

		test.beforeEach(async ({ page }) => {
			await loginUser(MOCK_USERS.alice, page);
		});

		test('Can browse article summaries', async ({ page }) => {
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

		test('Can see published articles', async ({ page }) => {
			await expect(page.getByText(MOCK_ARTICLES[1].body[0])).toBeVisible(); // Summary
			await expect(page.getByText(MOCK_ARTICLES[1].body[2])).not.toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].body[0])).toBeVisible(); // Summary
			await expect(page.getByText(MOCK_ARTICLES[3].body[2])).not.toBeVisible();

			// Published article by Alice
			await page.getByText(MOCK_ARTICLES[1].headline).click();
			await expect(
				page.locator('h1.article__headline', { hasText: MOCK_ARTICLES[3].headline })
			).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[1].body[0])).toBeVisible(); // Summary
			await expect(page.getByText(MOCK_ARTICLES[1].body[1])).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[1].body[2])).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[1].prompt)).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].headline)).not.toBeVisible();
			await expect(page.getByText('Delete')).toBeVisible();
			await expect(page.getByText('Publish')).not.toBeVisible();

			// Published article by Bob
			await page.locator('a.logo').click();
			await page.getByText(MOCK_ARTICLES[3].headline).click();
			await expect(
				page.locator('h1.article__headline', { hasText: MOCK_ARTICLES[3].headline })
			).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].body[0])).toBeVisible(); // Summary
			await expect(page.getByText(MOCK_ARTICLES[3].body[1])).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].body[2])).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].prompt)).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[1].headline)).not.toBeVisible();
			await expect(page.getByText('Delete')).not.toBeVisible();
			await expect(page.getByText('Publish')).not.toBeVisible();
		});

		test("Can only see user's authored draft articles", async ({ page }) => {
			// Published articles
			await expect(page.getByText(MOCK_ARTICLES[1].headline)).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[3].headline)).toBeVisible();

			// Draft articles
			await expect(page.getByText(MOCK_ARTICLES[0].headline)).not.toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[2].headline)).not.toBeVisible();

			// Drafts by Alice
			let user = await getUser(MOCK_USERS.alice.email);
			let article = await getLastArticle(
				`status = "${ArticleStatus.DRAFT}" && user = "${user?.id}"`
			);
			expect(article.headline).toBe(MOCK_ARTICLES[0].headline);
			await expect(page.getByText('Delete')).not.toBeVisible();
			await expect(page.getByText('Publish')).not.toBeVisible();

			await page.goto(`/article/${article.id}`);
			await expect(
				page.locator('h1.article__headline', { hasText: MOCK_ARTICLES[0].headline })
			).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[0].headline)).toBeVisible(); // Summary
			await expect(page.getByText('Delete')).toBeVisible();
			await expect(page.getByText('Publish')).toBeVisible();

			// A draft by Bob can't be viewed by Alice
			user = await getUser(MOCK_USERS.bob.email);
			article = await getLastArticle(`status = "${ArticleStatus.DRAFT}" && user = "${user?.id}"`);
			expect(article.headline).toBe(MOCK_ARTICLES[2].headline);

			await page.goto(`/article/${article.id}`);
			await expect(page.getByText('Error 404')).toBeVisible();
			await expect(page.getByText('Not found')).toBeVisible();
			await expect(page.getByText(MOCK_ARTICLES[2].headline)).not.toBeVisible();
		});

		test('Articles with audio are listenable', async ({ page }) => {
			// NOTE:
			// This test only checks that the player is visible when an audio path is present.

			const article = await getLastArticle(`headline = "${MOCK_ARTICLES[1].headline}"`);

			const audioData = readFileSync('tests/lib/fixtures/the-great-plague.mp3');
			const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
			const formData = new FormData();
			formData.append('audio', audioBlob, 'the-great-plague.mp3');
			await updateArticle(article.id, formData);

			await page.getByText(MOCK_ARTICLES[3].headline).click();
			await expect(page.locator('nav.article__audio', { hasText: 'Plus' })).not.toBeVisible();

			await page.locator('a.logo').click();
			await page.getByText(MOCK_ARTICLES[1].headline).click();
			await expect(page.locator('nav.article__audio', { hasText: 'Plus' })).toBeVisible();
			expect(await page.locator('audio.article__player').getAttribute('src')).toMatch(
				/^.*\/api\/files\/[^/]+\/[^/]+\/.+\.mp3$/
			); // 'xxx/api/files/xxx/xxx/xxx.mp3'
		});

		test('Can react to articles', async ({ page }) => {
			const reactionSummary = 'a.article-reactions-summary';
			expect(await page.locator(reactionSummary, { hasText: '0' }).count()).toBe(2);

			await page.getByText(MOCK_ARTICLES[1].headline).click();
			await expect(page.getByText(MOCK_ARTICLES[1].body[2])).toBeVisible();
			expect(await page.locator(reactionSummary, { hasText: '0' }).count()).toBe(1);

			await page.getByText('🤯').click();
			await expect(page.locator(reactionSummary, { hasText: '🤯 1' })).toBeVisible();

			await page.locator('a.logo').click();
			await expect(page.getByText(MOCK_ARTICLES[1].body[2])).not.toBeVisible();
			await expect(page.locator(reactionSummary, { hasText: '🤯 1' })).toBeVisible();

			// Logout as Alice
			await page.click('button[aria-label="Toggle navigation"]');
			await page.getByText('Logout').click();

			// Login as Bob
			await loginUser(MOCK_USERS.bob, page);
			await page.getByText(MOCK_ARTICLES[1].headline).click();
			await expect(page.getByText(MOCK_ARTICLES[1].body[2])).toBeVisible();
			await expect(page.locator(reactionSummary, { hasText: '🤯 1' })).toBeVisible();

			await page.getByText('🤔').click();
			await expect(page.locator(reactionSummary, { hasText: '🤯 2' })).toBeVisible();

			await page.locator('a.logo').click();
			await expect(page.getByText(MOCK_ARTICLES[1].body[2])).not.toBeVisible();
			await expect(page.locator(reactionSummary, { hasText: '🤯 2' })).toBeVisible();
		});
	});

	test("Can delete user's authored articles", async ({ page }) => {
		await resetDatabase();
		await seedTest();
		await loginUser(MOCK_USERS.alice, page);
		await expect(page.getByText(MOCK_ARTICLES[3].body[2])).not.toBeVisible();

		await page.getByText(MOCK_ARTICLES[3].headline).click();
		await expect(page.getByText(MOCK_ARTICLES[3].body[2])).toBeVisible();
		await expect(page.getByText('Delete')).not.toBeVisible();

		await page.locator('a.logo').click();
		await expect(page.getByText(MOCK_ARTICLES[1].body[2])).not.toBeVisible();

		await page.getByText(MOCK_ARTICLES[1].headline).click();
		await expect(page.getByText(MOCK_ARTICLES[1].body[2])).toBeVisible();
		await expect(page.getByText('Delete')).toBeVisible();

		await prepareToAcceptDialog(page, /Are you sure you want to delete the article?/);
		await page.getByText('Delete').click();
		await expect(page.getByText(MOCK_ARTICLES[1].body[2])).not.toBeVisible();
		await expect(
			page.locator('h1.section__h1', { hasText: MOCK_USERS.alice.nickname })
		).toBeVisible();
	});
});