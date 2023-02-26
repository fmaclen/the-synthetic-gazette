import { type Page, expect } from '@playwright/test';
import PocketBase from 'pocketbase';

export const TEST_ADMIN_USER = 'playwright@example.com';
export const TEST_ADMIN_PASSWORD = 'playwright';
export const TEST_USERS = {
	alice: {
		email: 'alice@example.com',
		nickname: 'Alice',
		password: 'playwright',
		passwordConfirm: 'playwright',
		terms: true
	},
	bob: {
		email: 'bob@example.com',
		nickname: 'Bob',
		password: 'playwright',
		passwordConfirm: 'playwright',
		terms: true
	},
	charlie: {
		email: 'charlie@example.com',
		nickname: 'Charlie',
		password: 'playwright',
		passwordConfirm: 'playwright',
		terms: true
	},
	dave: {
		email: 'dave@example.com',
		nickname: 'Dave',
		password: 'playwright',
		passwordConfirm: 'playwright',
		terms: true
	},
	eve: {
		email: 'eve@example.com',
		nickname: 'Eve',
		password: 'playwright',
		passwordConfirm: 'playwright',
		terms: true
	},
	frank: {
		email: 'frank@example.com',
		nickname: 'Frank',
		password: 'playwright',
		passwordConfirm: 'playwright',
		terms: true
	},
	grace: {
		email: 'grace@example.com',
		nickname: 'Grace',
		password: 'playwright',
		passwordConfirm: 'playwright',
		terms: true
	},
	henry: {
		email: 'henry@example.com',
		nickname: 'Henry',
		password: 'playwright',
		passwordConfirm: 'playwright',
		terms: true
	},
	isabelle: {
		email: 'isabelle@example.com',
		nickname: 'Isabelle',
		password: 'playwright',
		passwordConfirm: 'playwright',
		terms: true
	},
	jack: {
		email: 'jack@example.com',
		nickname: 'Jack',
		password: 'playwright',
		passwordConfirm: 'playwright',
		terms: true
	},
	kate: {
		email: 'kate@example.com',
		nickname: 'Kate',
		password: 'playwright',
		passwordConfirm: 'playwright',
		terms: true
	}
};

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

	// Delete all users
	const users = await pb.collection('users').getFullList(200);
	for (const user of users) {
		await pb.collection('users').delete(user.id);
	}

	// Delete all articles
	const articles = await pb.collection('articles').getFullList(200);
	for (const article of articles) {
		await pb.collection('articles').delete(article.id);
	}
}

export async function createUser(user: User): Promise<void> {
	await pb.collection('users').create(user);
}

export async function verifyUser(email: string): Promise<void> {
	const user = await pb.collection('users').getFirstListItem(`email = "${email}"`);
	await pb.collection('users').update(user.id, { verified: true });
}

export async function loginUser(user: User, page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('E-mail').fill(user.email);
	await page.getByLabel('Password', { exact: true }).fill(user.password);
	await page.locator('button[type=submit]', { hasText: 'Login' }).click();
	await expect(page.getByText('Generated by AI, curated by humans')).toBeVisible();
}

export async function createAndLoginUser(user: User, page: Page): Promise<void> {
	await createUser(user);
	await verifyUser(user.email);
	await loginUser(user, page);
}

export async function getLastArticle(query: string): Promise<any> {
	return await pb.collection('articles').getFirstListItem(query, { sort: '-created' });
}
