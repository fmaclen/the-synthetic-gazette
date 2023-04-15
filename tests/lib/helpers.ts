import type { ArticleCollection } from '$lib/pocketbase.schema.js';
import type { MockArticleCompletion } from '$lib/tests';
import { type Page, type TestInfo, expect } from '@playwright/test';
import PocketBase, { BaseAuthStore } from 'pocketbase';

import { type ArticleStatus, EXPAND_RECORD_RELATIONS } from '../../src/lib/articles.js';
import { MessageRole } from '../../src/lib/messages.js';
import { CURRENT_MODEL } from '../../src/lib/openai.js';
import { miniStringify } from '../../src/lib/utils.js';
import { MAX_DIFF_PIXEL_RATIO, TEST_ADMIN_PASSWORD, TEST_ADMIN_USER } from './fixtures.js';

interface User {
	email: string;
	nickname: string;
	password: string;
	passwordConfirm: string;
	terms: boolean;
}

let pb: PocketBase;
export async function resetDatabase(): Promise<void> {
	pb = new PocketBase(process.env.TEST_POCKETBASE_URL);
	await pb.admins.authWithPassword(TEST_ADMIN_USER, TEST_ADMIN_PASSWORD);

	// Delete all reactions
	const reactions = await pb.collection('reactions').getFullList(200);
	for (const reaction of reactions) {
		await pb.collection('reactions').delete(reaction.id);
	}

	// Delete all articles
	const articles = await pb.collection('articles').getFullList(200);
	for (const article of articles) {
		await pb.collection('articles').delete(article.id);
	}

	// Delete all users
	const users = await pb.collection('users').getFullList(200);
	for (const user of users) {
		await pb.collection('users').delete(user.id);
	}
}

export async function createUser(user: User): Promise<void> {
	await pb.collection('users').create(user);
}

export async function getUser(email: string): Promise<BaseAuthStore['model']> {
	return await pb.collection('users').getFirstListItem(`email = "${email}"`);
}

export async function verifyUser(email: string): Promise<void> {
	const user = await getUser(email);
	user && (await pb.collection('users').update(user.id, { verified: true }));
}

export async function loginUser(user: User, page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('E-mail').fill(user.email);
	await page.getByLabel('Password', { exact: true }).fill(user.password);

	const loginButton = page.locator('button[type=submit]', { hasText: 'Login' });
	await expect(loginButton).not.toBeDisabled();
	await loginButton.click();
	await expectToBeInHomepage(page);
}

export async function createAndLoginUser(user: User, page: Page): Promise<void> {
	await createUser(user);
	await verifyUser(user.email);
	await loginUser(user, page);
}

export async function logoutCurrentUser(page: Page) {
	await page.click('button[aria-label="Toggle navigation"]');
	await page.getByText('Logout').click();
}

export async function getLastArticle(query: string): Promise<ArticleCollection | null> {
	try {
		return await pb
			.collection('articles')
			.getFirstListItem(query, { sort: '-created', expand: EXPAND_RECORD_RELATIONS });
	} catch {
		return null;
	}
}

export async function createArticle(
	mockArticleCompletion: MockArticleCompletion,
	status: ArticleStatus,
	user: string
): Promise<ArticleCollection> {
	const article: ArticleCollection = await pb.collection('articles').create({
		...mockArticleCompletion,
		model: CURRENT_MODEL,
		status,
		user
	});

	// Create the initial user prompt
	await pb.collection('messages').create({
		article: article.id,
		role: MessageRole.USER,
		content: "Dear AI, I'd like you to write a good article pretty please with sugar on top"
	});

	// Only create a message if there is a `notes` key
	if (mockArticleCompletion.notes) {
		await pb.collection('messages').create({
			article: article.id,
			role: MessageRole.ASSISTANT,
			content: miniStringify(mockArticleCompletion)
		});
	}

	return article;
}

export async function updateArticle(id: string, formData: FormData) {
	await pb.collection('articles').update(id, formData);
}

export async function expectToBeInHomepage(page: Page) {
	await expect(page.getByText('Generated by AI, curated by humans')).toBeVisible();
}

export async function goToHomepageViaLogo(page: Page) {
	await page.locator('a.logo').click();
	await expectToBeInHomepage(page);
}

export const prepareToAcceptDialog = async (page: Page, message: RegExp) => {
	page.on('dialog', (dialog) => {
		expect(dialog.message()).toMatch(message);

		dialog.accept();
	});
};

// Playwright renames snapshots to match the current OS and browser, so we need to
// update the test configuration so it always matches the macOS + Chromium snapshot.
// REF: https://github.com/microsoft/playwright/issues/7575#issuecomment-1240566545
export const setSnapshotPath = (testInfo: TestInfo) => {
	testInfo.snapshotPath = (name: string) => `${testInfo.file}-snapshots/${name}`;
};

export async function matchSnapshot(page: Page, name: string) {
	// NOTE: We are currently only running snapshots locally on macOS.
	// To add run visual regression tests on CI we need to account for all the different
	// variations of browser and viewport resolutions (i.e. desktop/mobile).
	if (process.platform !== 'darwin') return;
	
	// Desktop
	expect(await page.screenshot({ fullPage: true })).toMatchSnapshot({ name: `${name}-desktop.png` , maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO });

	// Mobile
	await page.setViewportSize({ width: 375, height: 667 });
	expect(await page.screenshot({ fullPage: true })).toMatchSnapshot({ name: `${name}-mobile.png` , maxDiffPixelRatio: MAX_DIFF_PIXEL_RATIO });

	// Reset viewport size
	await page.setViewportSize({ width: 1280, height: 720 });
}
