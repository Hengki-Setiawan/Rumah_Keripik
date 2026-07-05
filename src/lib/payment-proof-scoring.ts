type PaymentProofForScore = {
  amount_claimed: number | null;
  status: 'pending' | 'accepted' | 'rejected';
  uploaded_at: string;
};

type OrderForScore = {
  total_bayar: number;
  payment_status: string;
};

export function scorePaymentProof(proof: PaymentProofForScore, order: OrderForScore | null) {
  const warnings: string[] = [];
  let score = 50;

  if (!order) {
    return { score: 0, warnings: ['Order tidak ditemukan'], level: 'danger' as const };
  }

  if (proof.amount_claimed == null) {
    warnings.push('Nominal klaim belum diisi pelanggan');
  } else if (proof.amount_claimed === order.total_bayar) {
    score += 35;
  } else {
    const diff = Math.abs(proof.amount_claimed - order.total_bayar);
    const tolerance = Math.max(1000, Math.round(order.total_bayar * 0.01));
    if (diff <= tolerance) {
      score += 15;
      warnings.push('Nominal klaim sedikit berbeda dari total order');
    } else {
      score -= 30;
      warnings.push('Nominal klaim berbeda jauh dari total order');
    }
  }

  if (order.payment_status === 'verified' && proof.status === 'pending') {
    score -= 15;
    warnings.push('Order sudah verified tetapi proof ini masih pending');
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const level: 'safe' | 'warning' | 'danger' = finalScore >= 80 ? 'safe' : finalScore >= 55 ? 'warning' : 'danger';
  return { score: finalScore, warnings, level };
}
