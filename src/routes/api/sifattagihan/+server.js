import { prisma } from '$lib/prisma.server.js';
export async function GET({ request }) {
	let token = request.headers.get('authorization');
	if (token && token.startsWith('Bearer ')) {
		token = token.slice(7, token.length);
	}
	if (!token) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}
	try {
		const sifatTagihan = await prisma.sifatTagihan.findMany();
		return new Response(JSON.stringify(sifatTagihan), { status: 200 });
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Error Unexpected' }), { status: 400 });
	}
}
