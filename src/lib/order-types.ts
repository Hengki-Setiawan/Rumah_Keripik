export type OrderStep =
  | 'IDLE'
  | 'GREETING'
  | 'PILIH_PRODUK'
  | 'INPUT_VARIAN'
  | 'INPUT_QTY'
  | 'CART_REVIEW'
  | 'FORM_NAMA'
  | 'FORM_ALAMAT'
  | 'CONFIRM_ALAMAT'
  | 'FORM_NOHP'
  | 'REKAP_ORDER'
  | 'DRAFT_TERSIMPAN'
  | 'BUKTI_DITERIMA'
  | 'TERVERIFIKASI'
  | 'SELESAI'
  | 'DIBATALKAN'
  | 'QA_MODE';

export interface CartItem {
  id_produk: string;
  nama_produk: string;
  varian?: string;
  qty: number;
  harga_satuan: number;
  subtotal: number;
}

export interface OrderContext {
  step: OrderStep;
  cart?: CartItem[];
  nama_penerima?: string;
  alamat_pengiriman?: string;
  no_hp?: string;
  id_transaksi?: string;
  kode_pesanan?: string;
  total_bayar?: number;
  bukti_url?: string;
  last_updated?: string;
  produk_aktif?: string;
  varian_aktif?: string;
  varian_tersedia?: string[];
  percobaan_pesan?: number;
  riwayat_qa?: string[];
  lat_pengiriman?: string;
  lng_pengiriman?: string;
  maps_link_pengiriman?: string;
  jarak_km?: number;
  shipping_cost?: number;
}
