export type CloudinaryImageVariant = 'thumb' | 'card' | 'detail' | 'proof' | 'qris';

const TRANSFORMS: Record<CloudinaryImageVariant, string> = {
  thumb: 'f_auto,q_auto,w_160,h_160,c_fill',
  card: 'f_auto,q_auto,w_500,c_fill',
  detail: 'f_auto,q_auto,w_900',
  proof: 'f_auto,q_auto,w_1000',
  qris: 'f_auto,q_auto,w_500',
};

export function getCloudinaryImageUrl(
  publicId: string | null | undefined,
  variant: CloudinaryImageVariant = 'card',
) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || !publicId) return null;

  return `https://res.cloudinary.com/${cloudName}/image/upload/${TRANSFORMS[variant]}/${publicId}`;
}

export function getProductImageUrl(publicId: string | null | undefined) {
  return getCloudinaryImageUrl(publicId, 'card');
}

export function getPaymentProofImageUrl(publicId: string | null | undefined) {
  return getCloudinaryImageUrl(publicId, 'proof');
}
