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
  void order;
  void proofs;
  return false;
}

export function getPaymentProofUploadBlockReason(order: OrderLike, proofs: ProofLike[] = []) {
  void proofs;
  if (isCodOrder(order)) return 'Pesanan COD tidak membutuhkan pembayaran online tambahan.';
  if (isPaymentVerified(order)) return 'Pembayaran sudah terverifikasi otomatis.';
  return 'Pembayaran manual sudah dimatikan. Lanjutkan bayar dari checkout online atau buka Pesanan Saya untuk mencoba lagi.';
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
  if (order.payment_status === 'gateway_failed') return 'Pembayaran online belum berhasil. Coba buka lagi checkout dari halaman status atau Pesanan Saya.';
  if (order.payment_status === 'proof_uploaded') return 'Riwayat verifikasi manual lama masih tercatat, tetapi pembayaran baru sekarang diproses otomatis.';
  if (order.payment_status === 'rejected') return 'Verifikasi manual lama pernah ditolak. Untuk pesanan baru, gunakan checkout online agar status diperbarui otomatis.';
  if (order.payment_status === 'cod_approved') return 'COD disetujui admin. Pesanan diproses.';
  if (order.payment_status === 'cod_rejected') return 'COD ditolak admin. Pesanan dibatalkan.';
  if (isCodOrder(order)) return 'Pesanan COD menunggu persetujuan admin.';
  return 'Lanjutkan pembayaran online lewat checkout yang tersedia. Setelah sukses, status pesanan akan diperbarui otomatis.';
}
