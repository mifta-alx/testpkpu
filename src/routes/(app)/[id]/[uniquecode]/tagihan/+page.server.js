import { prisma } from '$lib/prisma.server.js';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export async function load({ params }) {
	const { id, uniquecode } = params;
	const user = await prisma.users.findUnique({
		where: { uniqueCode: uniquecode }
	});
	if (user) {
		const kreditorData = await prisma.kreditor.findMany();
		const sifatTagihanData = await prisma.sifatTagihan.findMany();
		const tipeDokumenData = await prisma.tipeDokumen.findMany();
		return {
			status: 200,
			body: {
				kreditorData,
				sifatTagihanData,
				tipeDokumenData
			}
		};
	} else {
		return {
			status: 400,
			body: {
				error: 'Invalid uniquecode'
			}
		};
	}
}

function unformatPrice(price) {
	const formatted = price.replace(/,/g, '');
	return formatted;
}

export const actions = {
	addTagihan: async ({ request }) => {
		const formData = await request.formData();
		const tipeDokumenIds = formData.getAll('tipeDokumenId');
		const dokumenTagihanData = [];
		const dokumens = formData.getAll('dokumen');
		const {
			kreditorId,
			pertanggal,
			hutangPokok,
			bunga,
			denda,
			sifatTagihanId,
			jumlahTagihan,
			mulaiTertunggak,
			jumlahHari
		} = Object.fromEntries(formData);
		const allowedFileTypes = ['application/pdf'];
		const maxFileSize = 2 * 1024 * 1024; // 2 MB
		const validation = {
			success: false,
			errors: []
		};
		try {
			if (!kreditorId) {
				validation.errors.push({ field: 'kreditorId', message: 'required' });
			}
			if (!pertanggal) {
				validation.errors.push({ field: 'pertanggal', message: 'required' });
			}
			if (!hutangPokok) {
				validation.errors.push({ field: 'hutangPokok', message: 'required' });
			}
			if (!denda) {
				validation.errors.push({ field: 'denda', message: 'required' });
			}
			if (!bunga) {
				validation.errors.push({ field: 'bunga', message: 'required' });
			}
			if (!sifatTagihanId) {
				validation.errors.push({ field: 'sifatTagihanId', message: 'required' });
			}
			if (!jumlahTagihan) {
				validation.errors.push({ field: 'jumlahTagihan', message: 'required' });
			}
			if (!mulaiTertunggak) {
				validation.errors.push({ field: 'mulaiTertunggak', message: 'required' });
			}
			if (!jumlahHari) {
				validation.errors.push({ field: 'jumlahHari', message: 'required' });
			}

			if (!dokumens || dokumens.length === 0) {
				validation.errors.push({ field: 'dokumen', message: 'required' });
			}

			for (const key in tipeDokumenIds) {
				const dokumen = dokumens[key];

				if (dokumen.size > maxFileSize) {
					validation.errors.push({ field: `dokumen.${key}`, message: 'File terlalu besar' });
				}
				if (!allowedFileTypes.includes(dokumen.type)) {
					validation.errors.push({ field: `dokumen.${key}`, message: 'File harus berformat PDF' });
				}
			}

			if (validation?.errors.length > 0) {
				return validation;
			}
			const createdTagihan = await prisma.tagihan.create({
				data: {
					kreditorId: parseInt(kreditorId),
					pertanggal,
					hutangPokok: unformatPrice(hutangPokok),
					bunga: unformatPrice(bunga),
					denda: unformatPrice(denda),
					sifatTagihanId: parseInt(sifatTagihanId),
					jumlahTagihan,
					mulaiTertunggak,
					jumlahHari
				}
			});

			const tagihanId = createdTagihan.id;

			for (const key in tipeDokumenIds) {
				const tipeDokumenId = tipeDokumenIds[key];
				const dokumen = dokumens[key];
				dokumenTagihanData.push({
					tipeDokumenId: parseInt(tipeDokumenId) ?? 0,
					dokumen: dokumen.name,
					tagihanId
				});
			}

			await prisma.dokumenTagihan.createMany({
				data: dokumenTagihanData
			});

			if (!dokumens) {
				console.error('Invalid file data');
				return {
					status: 400,
					body: 'Invalid file data'
				};
			}

			const uploadsDir = join(process.cwd(), 'static/doc/');
			mkdirSync(uploadsDir, { recursive: true });

			for (const file of dokumens) {
				const filePath = join(uploadsDir, file.name);

				writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));
				console.log('uploadsDir:', uploadsDir);
				console.log('file:', file);
			}
			return {
				success: true,
				message: 'Tagihan berhasil ditambahkan'
			};
		} catch (error) {
			console.log(error);
			return { success: false, message: 'Tagihan gagal ditambahkan' };
		}
	},
	addKreditor: async ({ request }) => {
		const formData = await request.formData();
		const { nama, email, noTelp, alamat } = Object.fromEntries(formData);
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		const validation = {
			success: false,
			errors: []
		};

		try {
			if (!nama) {
				validation.errors.push({ field: 'nama', message: 'Nama tidak boleh kosong!' });
			}
			if (!email) {
				validation.errors.push({ field: 'email', message: 'Email tidak boleh kosong!' });
			}else if (!emailRegex.test(email)) {
				validation.errors.push({ field: 'email', message: 'Format email tidak valid!' });
			}
			if (!noTelp) {
				validation.errors.push({ field: 'noTelp', message: 'No Telepon tidak boleh kosong!' });
			}
			if (!alamat) {
				validation.errors.push({ field: 'alamat', message: 'Alamat tidak boleh kosong!' });
			}
			if (validation?.errors.length > 0) {
				return validation;
			}
			await prisma.kreditor.create({
				data: {
					nama,
					email,
					noTelp,
					alamat
				}
			});

			return { success: true, message: 'Kreditor berhasil ditambahkan' };
		} catch (error) {
			console.log(error);
			if (error.code === 'P2002' && error.meta.target.includes('email')) {
				return {
					success: false,
					message: 'Email kreditor sudah terdaftar, silahkan periksa kembali'
				};
			}
			return { success: false, message: 'Kreditor gagal ditambahkan' };
		}
	}
};