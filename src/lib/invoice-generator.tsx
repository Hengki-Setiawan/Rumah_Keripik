/**
 * invoice-generator.tsx — Module untuk generate PDF Invoice dan upload ke Cloudinary
 */

import { db } from './db';
import { transaksi, detailTransaksi, produk } from './schema';
import { eq } from 'drizzle-orm';
import { uploadInvoicePDF } from './cloudinary';
import React from 'react';
import ReactPDF, {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

// Stylesheet untuk layout PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#333333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#8B5CF6',
    paddingBottom: 15,
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  subtitle: {
    fontSize: 10,
    color: '#666666',
    marginTop: 2,
  },
  invoiceInfo: {
    textAlign: 'right',
  },
  invoiceId: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  metaCol: {
    flexDirection: 'column',
    width: '45%',
  },
  metaLabel: {
    fontSize: 8,
    color: '#666666',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  table: {
    flexDirection: 'column',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    padding: 6,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    padding: 6,
  },
  colDesc: { width: '50%' },
  colQty: { width: '15%', textAlign: 'center' },
  colPrice: { width: '15%', textAlign: 'right' },
  colSub: { width: '20%', textAlign: 'right' },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  totalBox: {
    width: '40%',
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: {
    fontWeight: 'bold',
  },
  totalValue: {
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    textAlign: 'center',
    color: '#999999',
    fontSize: 8,
  },
});

interface InvoicePDFProps {
  tx: any;
  items: any[];
}

// Komponen PDF Document React-PDF
const InvoiceDocument = ({ tx, items }: InvoicePDFProps) => {
  const formattedDate = new Date(tx.waktu_simpan + 'Z').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const totalBayar = tx.total_bayar || 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.title}>RUMAH KERIPIK</Text>
            <Text style={styles.subtitle}>Camilan Gurih & Berkualitas</Text>
          </View>
          <View style={styles.invoiceInfo}>
            <Text style={styles.invoiceId}>INVOICE</Text>
            <Text style={{ marginTop: 4 }}>No: #{tx.id_transaksi}</Text>
            <Text style={styles.subtitle}>Tanggal: {formattedDate}</Text>
          </View>
        </View>

        {/* Meta Info */}
        <View style={styles.metaContainer}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Diterbitkan Oleh</Text>
            <Text style={[styles.metaValue, { fontWeight: 'bold' }]}>Rumah Keripik HQ</Text>
            <Text style={styles.metaValue}>Samarinda, Kalimantan Timur</Text>
            <Text style={styles.metaValue}>WA: +62 812-3456-7890</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Ditujukan Kepada</Text>
            <Text style={[styles.metaValue, { fontWeight: 'bold' }]}>
              {tx.nama_penerima || tx.nama_pelanggan || tx.nama_warung || 'Pelanggan Setia'}
            </Text>
            <Text style={styles.metaValue}>{tx.alamat_penerima || 'Ambil di Tempat / WA Order'}</Text>
            <Text style={styles.metaValue}>No. HP: {tx.no_hp_penerima || tx.no_wa_pelanggan || '-'}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Nama Produk</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Harga</Text>
            <Text style={styles.colSub}>Subtotal</Text>
          </View>

          {items.map((item, idx) => (
            <View style={styles.tableRow} key={idx}>
              <Text style={styles.colDesc}>{item.nama_produk}</Text>
              <Text style={styles.colQty}>{item.qty_terjual}</Text>
              <Text style={styles.colPrice}>
                Rp {item.harga_snapshot.toLocaleString('id-ID')}
              </Text>
              <Text style={styles.colSub}>
                Rp {item.subtotal.toLocaleString('id-ID')}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalContainer}>
          <View style={styles.totalBox}>
            <View style={styles.totalRow}>
              <Text>Total Tagihan</Text>
              <Text>Rp {totalBayar.toLocaleString('id-ID')}</Text>
            </View>
            <View style={[styles.totalRow, { marginTop: 4 }]}>
              <Text style={styles.totalLabel}>Status Pembayaran</Text>
              <Text style={styles.totalValue}>{tx.status_pembayaran}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Terima kasih atas pesanan Anda di Rumah Keripik!</Text>
          <Text style={{ marginTop: 2 }}>Invoice ini sah di-generate otomatis oleh sistem AI Rumah Keripik</Text>
        </View>
      </Page>
    </Document>
  );
};

/**
 * Generate Invoice PDF ke dalam bentuk Buffer, kemudian upload ke Cloudinary,
 * dan simpan secure URL-nya ke kolom invoice_url di database transaksi.
 */
export async function generateAndSaveInvoice(id_transaksi: string): Promise<string> {
  // 1. Fetch data transaksi
  const txRows = await db
    .select()
    .from(transaksi)
    .where(eq(transaksi.id_transaksi, id_transaksi))
    .limit(1);

  if (txRows.length === 0) {
    throw new Error(`Transaksi ${id_transaksi} tidak ditemukan`);
  }

  const tx = txRows[0];

  // 2. Fetch detail items transaksi
  const items = await db
    .select({
      id_produk: detailTransaksi.id_produk,
      qty_terjual: detailTransaksi.qty_terjual,
      harga_snapshot: detailTransaksi.harga_snapshot,
      subtotal: detailTransaksi.subtotal,
      nama_produk: produk.nama_produk,
    })
    .from(detailTransaksi)
    .leftJoin(produk, eq(detailTransaksi.id_produk, produk.id_produk))
    .where(eq(detailTransaksi.id_transaksi, id_transaksi));

  // 3. Render React-PDF ke Buffer
  const pdfStream = await ReactPDF.renderToStream(
    <InvoiceDocument tx={tx} items={items} />
  );
  
  const chunks: any[] = [];
  for await (const chunk of pdfStream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  // 4. Upload ke Cloudinary
  const uploadResult = await uploadInvoicePDF(buffer, id_transaksi);
  const secureUrl = uploadResult.secure_url;

  // 5. Simpan URL ke tabel transaksi
  await db
    .update(transaksi)
    .set({
      invoice_url: secureUrl,
    })
    .where(eq(transaksi.id_transaksi, id_transaksi));

  return secureUrl;
}
