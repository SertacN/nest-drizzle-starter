import type { UploadResult } from '../types/upload';
import type { Requester } from './http';

export function createUploadsService({ request }: Requester) {
	return {
		/** Returns the public URL of the stored (re-encoded WebP) image. */
		image: (file: File | Blob) => {
			const form = new FormData();
			form.append('file', file);
			return request<UploadResult>('/api/v1/uploads/image', { method: 'POST', body: form });
		},
	};
}
