type OrderLike = {
  payment_status: string;
  order_status: string;
  status_pembayaran: string;
  payment_method: string | null;
};

type ProofLike = {
  status: 'pending' | 'accepted' | 'rejected';
};

export const MAX_PAYMENT_PROOF_UPLOADS = 3;

export function isPaymentVerified(order: OrderLike) {
  return order.payment_status === 'verified' || order.status_pembayaran === 'Lunas';
}

export function isCodOrder(order: OrderLike) {
  return order.payment_method === 'cod';
}

export function canUploadPaymentProof(order: OrderLike, proofs: ProofLike[] = []) {
  if (isCodOrder(order) || isPaymentVerified(order)) return false;
  if (proofs.length >= MAX_PAYMENT_PROOF_UPLOADS) return false;
  return !proofs.some((proof) => proof.status === 'pending');
}

export function getPaymentProofUploadBlockReason(order: OrderLike, proofs: ProofLike[] = []) {
  if (isCodOrder(order)) return 'Pesanan COD tidak membutuhkan upload bukti pembayaran.';
  if (isPaymentVerified(order)) return 'Pembayaran sudah terverifikasi.';
  if (proofs.some((proof) => proof.status === 'pending')) return 'Bukti pembayaran sedang menunggu verifikasi admin.';
  if (proofs.length >= MAX_PAYMENT_PROOF_UPLOADS) return 'Batas upload bukti pembayaran tercapai. Hubungi admin untuk bantuan.';
  return 'Upload bukti belum tersedia untuk status pesanan ini.';
}

export function canApprovePaymentProof(order: OrderLike, proof: ProofLike) {
  return !isPaymentVerified(order) && !isCodOrder(order) && proof.status === 'pending';
}

export function canRejectPaymentProof(order: OrderLike, proof: ProofLike) {
  return !isPaymentVerified(order) && !isCodOrder(order) && proof.status === 'pending';
}

export function canIssueReceipt(order: OrderLike) {
  return isPaymentVerified(order);
}

export function canPrintPackingLabel(order: OrderLike) {
  return isPaymentVerified(order) || order.payment_status === 'cod_approved' || order.order_status === 'processing';
}

export function canApproveCod(order: OrderLike) {
  return isCodOrder(order) && ['cod_requested', 'cod_pending'].includes(order.payment_status) && order.order_status !== 'cancelled';
}

export function canRejectCod(order: OrderLike) {
  return isCodOrder(order) && ['cod_requested', 'cod_pending'].includes(order.payment_status) && order.order_status !== 'cancelled';
}

export function getCustomerStatusMessage(order: OrderLike) {
  if (isPaymentVerified(order)) return 'Pembayaran sudah diverifikasi. Pesanan diproses admin.';
  if (order.payment_status === 'proof_uploaded') return 'Bukti pembayaran sedang menunggu verifikasi admin.';
  if (order.payment_status === 'rejected') return 'Bukti pembayaran ditolak. Upload ulang bukti yang benar.';
  if (order.payment_status === 'cod_approved') return 'COD disetujui admin. Pesanan diproses.';
  if (order.payment_status === 'cod_rejected') return 'COD ditolak admin. Pesanan dibatalkan.';
  if (isCodOrder(order)) return 'Pesanan COD menunggu persetujuan admin.';
  return 'Silakan bayar sesuai instruksi lalu upload bukti pembayaran.';
}
