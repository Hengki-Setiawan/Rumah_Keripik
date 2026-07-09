import { db } from './db';
import { produk, transaksi, detailTransaksi, pelangganChatbot } from './schema';
import { eq } from 'drizzle-orm';
import type { OrderContext, CartItem } from './order-types';
import { generateIdTransaksi, generateKodePesanan } from './id-generator';
import { estimateShipping, geocodeAddress } from './geocoding';
import { extractCoordsFromText } from './location-parser';
import { processLocationMessage } from './location-flow';
import { buildPersonalizedGreeting } from './memory-engine';
import { updateMemoryAfterOrder, saveRating } from './memory-engine';
import { enqueueJob } from './worker-queue';

/**
 * Tampilkan daftar menu/katalog produk aktif
 */
export async function getMenuText(): Promise<string> {
  const items = await db
    .select()
    .from(produk)
    .where(eq(produk.is_active, 1));
  
  if (items.length === 0) {
    return 'Maaf kak, saat ini semua produk kami sedang kosong stok.';
  }

  const lines = items.map((p, idx) => {
    const stockStatus = p.stok_gudang_utama > 0 
      ? `(Stok: ${p.stok_gudang_utama})` 
      : '*(Stok Habis)*';
    return `${idx + 1}. *${p.nama_produk}* - Rp ${p.harga_jual.toLocaleString('id-ID')} ${stockStatus}`;
  });

  return (
    `📋 *KATALOG PRODUK RUMAH KERIPIK* 📋\n\n` +
    lines.join('\n') +
    `\n\nKetik nama produk yang ingin Kakak pesan ya (contoh: *Kripik Pedas*).`
  );
}

/**
 * Handler sapaan awal untuk memulai flow pesanan baru
 */
export async function handleGreeting(
  no_wa: string,
  message: string,
  pelanggan: any
): Promise<{ response: string; source: 'rule'; newContext: OrderContext }> {
  const menuText = await getMenuText();
  const nama = pelanggan?.nama_pelanggan || '';

  const personalized = await buildPersonalizedGreeting(no_wa);
  
  const greeting = personalized 
    ? `Halo${nama ? ` Kak ${nama}` : ''}! ${personalized}\n\n${menuText}`
    : `Halo${nama ? ` Kak ${nama}` : ''}! Selamat datang di *Rumah Keripik* 👋\n\n${menuText}`;

  const newContext: OrderContext = {
    step: 'PILIH_PRODUK',
    cart: [],
    sessionId: `tg_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    last_updated: new Date().toISOString(),
  };

  return { response: greeting, source: 'rule', newContext };
}

/**
 * Main state machine processor
 */
export async function processOrderState(
  no_wa: string,
  message: string,
  ctx: OrderContext,
  pelanggan: any
): Promise<{ response: string; source: 'rule'; newContext: OrderContext }> {
  const lowerMsg = message.trim().toLowerCase();

  // Cancel keyword
  if (lowerMsg === 'batal' || lowerMsg === 'cancel' || lowerMsg === 'reset') {
    return {
      response: 'Sesi pemesanan Kakak telah dibatalkan. Ada yang bisa kami bantu lagi? Ketik *pesan* untuk memulai kembali.',
      source: 'rule',
      newContext: { step: 'IDLE' },
    };
  }

  switch (ctx.step) {
    case 'INPUT_VARIAN': {
      const activeId = ctx.produk_aktif;
      if (!activeId) {
        return {
          response: 'Terjadi kesalahan, silakan pilih produk dari awal.',
          source: 'rule',
          newContext: { step: 'PILIH_PRODUK' },
        };
      }

      const [activeProd] = await db.select().from(produk).where(eq(produk.id_produk, activeId)).limit(1);
      if (!activeProd) {
        return {
          response: 'Produk tidak ditemukan, silakan pilih ulang.',
          source: 'rule',
          newContext: { step: 'PILIH_PRODUK' },
        };
      }

      const varian = message.trim();
      const tersedia = ctx.varian_tersedia || [];
      const matchVarian = tersedia.find(
        (v) => v.toLowerCase() === varian.toLowerCase() || v.toLowerCase().includes(varian.toLowerCase())
      );

      if (!matchVarian) {
        return {
          response: `Varian *"${varian}"* tidak tersedia untuk ${activeProd.nama_produk}.\n\nVarian tersedia: ${tersedia.join(', ')}\n\nSilakan pilih varian yang tersedia.`,
          source: 'rule',
          newContext: ctx,
        };
      }

      const newCtx: OrderContext = {
        ...ctx,
        varian_aktif: matchVarian,
        step: 'INPUT_QTY',
        last_updated: new Date().toISOString(),
      };

      return {
        response: `Kakak memilih *${activeProd.nama_produk} ${matchVarian}* - Rp ${activeProd.harga_jual.toLocaleString('id-ID')}/pack.\n\nMau pesan berapa pack kak?`,
        source: 'rule',
        newContext: newCtx,
      };
    }

    case 'PILIH_PRODUK': {
      // User is specifying which product they want
      const allProducts = await db.select().from(produk).where(eq(produk.is_active, 1));
      
      // Find matching product (case-insensitive fuzzy match)
      const matched = allProducts.find(
        (p) => 
          p.nama_produk.toLowerCase().includes(lowerMsg) || 
          lowerMsg.includes(p.nama_produk.toLowerCase())
      );

      if (!matched) {
        return {
          response: `Maaf kak, produk *"${message}"* tidak ditemukan di katalog. Silakan ketik nama produk yang sesuai dari menu:\n\n` + await getMenuText(),
          source: 'rule',
          newContext: ctx,
        };
      }

      if (matched.stok_gudang_utama <= 0) {
        return {
          response: `Maaf kak, stok untuk *${matched.nama_produk}* saat ini sedang habis 😢 Silakan pilih varian keripik lainnya.`,
          source: 'rule',
          newContext: ctx,
        };
      }

      // Check for product variants (from deskripsi or predefined list)
      const variants = extractVariants(matched.deskripsi);
      if (variants.length > 0) {
        const newCtx: OrderContext = {
          ...ctx,
          produk_aktif: matched.id_produk,
          varian_tersedia: variants,
          step: 'INPUT_VARIAN',
          last_updated: new Date().toISOString(),
        };

        return {
          response: `Kakak memilih *${matched.nama_produk}* - Rp ${matched.harga_jual.toLocaleString('id-ID')}/pack.\n\nVarian tersedia: ${variants.join(', ')}\n\nSilakan pilih varian yang diinginkan kak.`,
          source: 'rule',
          newContext: newCtx,
        };
      }

      // No variants → langsung minta qty
      const newCtx: OrderContext = {
        ...ctx,
        produk_aktif: matched.id_produk,
        step: 'INPUT_QTY',
        last_updated: new Date().toISOString(),
      };

      return {
        response: `Kakak memilih *${matched.nama_produk}* - Rp ${matched.harga_jual.toLocaleString('id-ID')}/pack.\n\nMau pesan berapa pack kak? (Ketik angkanya saja, contoh: *3*)`,
        source: 'rule',
        newContext: newCtx,
      };
    }

    case 'INPUT_QTY': {
      // User specifies Qty number
      const qty = parseInt(message.replace(/\D/g, ''), 10);
      if (isNaN(qty) || qty <= 0) {
        return {
          response: 'Mohon masukkan jumlah pesanan berupa angka yang valid ya kak (contoh: *2*).',
          source: 'rule',
          newContext: ctx,
        };
      }

      const id_produk = ctx.produk_aktif!;
      const [prod] = await db.select().from(produk).where(eq(produk.id_produk, id_produk)).limit(1);

      if (!prod) {
        return {
          response: 'Terjadi kesalahan sistem, produk tidak ditemukan. Sesi dibatalkan.',
          source: 'rule',
          newContext: { step: 'IDLE' },
        };
      }

      if (prod.stok_gudang_utama < qty) {
        return {
          response: `Maaf kak, stok *${prod.nama_produk}* tidak mencukupi. Stok tersedia saat ini: *${prod.stok_gudang_utama}* pack. Silakan masukkan jumlah yang lebih kecil.`,
          source: 'rule',
          newContext: ctx,
        };
      }

      // Add to cart
      const cart: CartItem[] = ctx.cart || [];
      const existingIdx = cart.findIndex((item) => item.id_produk === id_produk);

      const newItem: CartItem = {
        id_produk: prod.id_produk,
        nama_produk: prod.nama_produk,
        qty,
        harga_satuan: prod.harga_jual,
        subtotal: prod.harga_jual * qty,
      };

      if (existingIdx >= 0) {
        cart[existingIdx] = newItem;
      } else {
        cart.push(newItem);
      }

      const newCtx: OrderContext = {
        ...ctx,
        cart,
        produk_aktif: undefined,
        step: 'CART_REVIEW',
        last_updated: new Date().toISOString(),
      };

      const cartLines = cart.map((item, idx) => `- ${item.nama_produk} x${item.qty} = Rp ${item.subtotal.toLocaleString('id-ID')}`);
      const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

      return {
        response: 
          `🛒 *Isi Keranjang Belanja Anda:* 🛒\n\n` +
          cartLines.join('\n') +
          `\n\n*Total Belanja:* Rp ${cartTotal.toLocaleString('id-ID')}\n\n` +
          `Apakah Kakak ingin menambah produk lain?\n` +
          `- Jika YA, ketik nama produk lain.\n` +
          `- Jika SELESAI, ketik *lanjut* atau *checkout*.`,
        source: 'rule',
        newContext: newCtx,
      };
    }

    case 'CART_REVIEW': {
      // User says checkout/lanjut OR wants to add more products
      if (lowerMsg === 'lanjut' || lowerMsg === 'checkout' || lowerMsg === 'selesai' || lowerMsg === 'ok') {
        const newCtx: OrderContext = {
          ...ctx,
          step: 'FORM_NAMA',
          last_updated: new Date().toISOString(),
        };
        return {
          response: 'Baik, lanjut ke proses pengiriman. Siapa nama penerima pesanan ini kak?',
          source: 'rule',
          newContext: newCtx,
        };
      }

      // Otherwise, treat input as product selection
      const allProducts = await db.select().from(produk).where(eq(produk.is_active, 1));
      const matched = allProducts.find(
        (p) => 
          p.nama_produk.toLowerCase().includes(lowerMsg) || 
          lowerMsg.includes(p.nama_produk.toLowerCase())
      );

      if (!matched) {
        return {
          response: `Pilihan tidak dikenal. Ketik *lanjut* untuk checkout, atau pilih produk dari katalog berikut:\n\n` + await getMenuText(),
          source: 'rule',
          newContext: ctx,
        };
      }

      if (matched.stok_gudang_utama <= 0) {
        return {
          response: `Maaf kak, stok *${matched.nama_produk}* sedang habis. Silakan pilih varian lain.`,
          source: 'rule',
          newContext: ctx,
        };
      }

      const newCtx: OrderContext = {
        ...ctx,
        produk_aktif: matched.id_produk,
        step: 'INPUT_QTY',
        last_updated: new Date().toISOString(),
      };

      return {
        response: `Kakak memilih *${matched.nama_produk}* - Rp ${matched.harga_jual.toLocaleString('id-ID')}/pack.\n\nMau pesan berapa pack kak?`,
        source: 'rule',
        newContext: newCtx,
      };
    }

    case 'FORM_NAMA': {
      // User inputs recipient's name
      const name = message.trim();
      if (name.length < 2) {
        return {
          response: 'Mohon masukkan nama penerima yang jelas ya kak.',
          source: 'rule',
          newContext: ctx,
        };
      }

      const newCtx: OrderContext = {
        ...ctx,
        nama_penerima: name,
        step: 'FORM_ALAMAT',
        last_updated: new Date().toISOString(),
      };

      return {
        response: 
          `Terima kasih Kak ${name}! 😊\n\n` +
          `Di mana alamat pengiriman pesanan Kakak?\n` +
          `Kakak bisa:\n` +
          `1. Ketik alamat lengkap\n` +
          `2. Share Lokasi WA (Pin Lokasi)\n` +
          `3. Kirim link Google Maps`,
        source: 'rule',
        newContext: newCtx,
      };
    }

    case 'FORM_ALAMAT': {
      // Text address manual input (if not location message/maps link, which bypasses here)
      const address = message.trim();
      if (address.length < 8) {
        return {
          response: 'Mohon masukkan alamat lengkap pengiriman kak (nama jalan, RT/RW, kelurahan/kecamatan).',
          source: 'rule',
          newContext: ctx,
        };
      }

      const mapsLocation = await extractCoordsFromText(address);
      if (mapsLocation) {
        return {
          ...(await processLocationMessage(no_wa, mapsLocation, ctx)),
          source: 'rule',
        };
      }

      const coords = await geocodeAddress(address);
      if (coords) {
        return {
          ...(await processLocationMessage(no_wa, { ...coords, address, source: 'geocoded' }, ctx)),
          source: 'rule',
        };
      }

      const newCtx: OrderContext = {
        ...ctx,
        alamat_pengiriman: address,
        step: 'FORM_NOHP',
        last_updated: new Date().toISOString(),
      };

      return {
        response: `Terima kasih, alamat sudah kami catat kak 😊\n\nNomor HP yang bisa dihubungi? (Ketik *lewat* jika mau pakai nomor WA ini)`,
        source: 'rule',
        newContext: newCtx,
      };
    }

    case 'FORM_NOHP': {
      let noHp = message.trim();
      if (noHp.toLowerCase() === 'lewat' || noHp.toLowerCase() === 'ga usah' || noHp.toLowerCase() === 'skip') {
        noHp = '';
      }

      const newCtx: OrderContext = {
        ...ctx,
        no_hp: noHp,
        step: 'REKAP_ORDER',
        last_updated: new Date().toISOString(),
      };

      return showOrderSummary(newCtx);
    }

    case 'CONFIRM_ALAMAT': {
      // Step triggered after coordinates geocoding
      if (lowerMsg === 'ya' || lowerMsg === 'benar' || lowerMsg === 'oke' || lowerMsg === 'ok') {
        const newCtx: OrderContext = {
          ...ctx,
          step: ctx.no_hp ? 'REKAP_ORDER' : 'FORM_NOHP',
          last_updated: new Date().toISOString(),
        };

        if (newCtx.step === 'FORM_NOHP') {
          return {
            response: 'Nomor HP yang bisa dihubungi? (Ketik *lewat* jika mau pakai nomor chat ini)',
            source: 'rule',
            newContext: newCtx,
          };
        }

        return showOrderSummary(newCtx);
      } else {
        const newCtx: OrderContext = {
          ...ctx,
          step: 'FORM_ALAMAT',
          last_updated: new Date().toISOString(),
        };
        return {
          response: 'Baik, silakan kirim ulang alamat atau pin lokasi yang benar kak.',
          source: 'rule',
          newContext: newCtx,
        };
      }
    }

    case 'REKAP_ORDER': {
      if (lowerMsg === 'ya' || lowerMsg === 'benar' || lowerMsg === 'oke' || lowerMsg === 'ok') {
        // Create actual transaction record in database
        try {
          const id_transaksi = await generateIdTransaksi();
          const kode_pesanan = generateKodePesanan();
          const cart = ctx.cart || [];
          const belanjaTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
          const totalBayar = belanjaTotal + (ctx.shipping_cost || 0);

          await db.transaction(async (tx) => {
            // Insert transaksi
            await tx.insert(transaksi).values({
              id_transaksi,
              no_wa_pelanggan: no_wa,
              id_session: ctx.sessionId || null,
              tipe_penjualan: 'Online_WA',
              total_bayar: totalBayar,
              status_pembayaran: 'Menunggu_Bayar',
              kode_pesanan,
              nama_penerima: ctx.nama_penerima,
              alamat_penerima: ctx.alamat_pengiriman,
              no_hp_penerima: ctx.no_hp || null,
              bukti_transfer_url: null,
              sumber_order: no_wa.startsWith('tg_') ? 'Telegram' : 'WA',
              lat_pengiriman: ctx.lat_pengiriman || null,
              lng_pengiriman: ctx.lng_pengiriman || null,
              jarak_km_dari_gudang: ctx.jarak_km ? String(ctx.jarak_km) : null,
              catatan: `Chatbot order. Shipping: ${ctx.shipping_cost}`,
            });

            // Insert detail_transaksi
            for (const item of cart) {
              await tx.insert(detailTransaksi).values({
                id_transaksi,
                id_produk: item.id_produk,
                qty_terjual: item.qty,
                harga_snapshot: item.harga_satuan,
                subtotal: item.subtotal,
              });
            }
          });

          // Save active transaction to context
          const newCtx: OrderContext = {
            ...ctx,
            step: 'DRAFT_TERSIMPAN',
            id_transaksi,
            kode_pesanan,
            total_bayar: totalBayar,
            last_updated: new Date().toISOString(),
          };

          return {
            response:
              `✅ *Pesanan Kakak telah berhasil dicatat!* ✅\n\n` +
              `🔖 *Kode Pesanan:* ${kode_pesanan}\n` +
              `💰 *Total Pembayaran:* Rp ${totalBayar.toLocaleString('id-ID')}\n\n` +
              `💳 *INFORMASI REKENING TRANSFER:*\n` +
              `*Bank BNI:* 123-456-7890\n` +
              `*Atas Nama:* RUMAH KERIPIK\n\n` +
              `Silakan lakukan transfer sesuai total belanja. Setelah transfer, *kirim foto bukti transfer/pembayaran Kakak di sini* ya untuk proses verifikasi. Terima kasih! 🙏`,
            source: 'rule',
            newContext: newCtx,
          };
        } catch (dbErr) {
          console.error('[StateMachine] Gagal checkout transaksi:', dbErr);
          return {
            response: 'Maaf kak, ada kendala sistem saat menyimpan pesanan Anda. Silakan coba konfirmasi ulang.',
            source: 'rule',
            newContext: ctx,
          };
        }
      } else {
        return {
          response: 'Apakah pesanan di atas sudah benar kak? Ketik *ya* untuk konfirmasi pesanan, atau ketik *batal* untuk membatalkan.',
          source: 'rule',
          newContext: ctx,
        };
      }
    }

    case 'DRAFT_TERSIMPAN': {
      return {
        response: `Pesanan dengan Kode *${ctx.kode_pesanan || ctx.id_transaksi}* masih menunggu pembayaran 💳\n\nTotal: *Rp ${(ctx.total_bayar || 0).toLocaleString('id-ID')}*\nRekening: *Bank BNI 123-456-7890 a/n RUMAH KERIPIK*\n\nSetelah transfer, kirimkan *foto bukti transfer* di chat ini ya kak 📸`,
        source: 'rule',
        newContext: ctx,
      };
    }

    case 'BUKTI_DITERIMA': {
      return {
        response: `✅ *Bukti pembayaran sedang diverifikasi*\n\nKode: ${ctx.kode_pesanan || ctx.id_transaksi}\nStatus: *Menunggu Verifikasi Admin*\n\nKami akan mengonfirmasi setelah pembayaran diverifikasi ya kak 🙏`,
        source: 'rule',
        newContext: ctx,
      };
    }

    case 'TERVERIFIKASI': {
      return {
        response:
          `🎉 *Pembayaran Terverifikasi!* 🎉\n\n` +
          `Pesanan *${ctx.kode_pesanan || ctx.id_transaksi}* sudah dikonfirmasi ✅\n\n` +
          `Pesanan Kakak akan segera kami proses dan kirim.\n` +
          `Estimasi pengiriman: 1-2 hari kerja 📦\n\n` +
          `Terima kasih sudah berbelanja di *Rumah Keripik* 😊🙏`,
        source: 'rule',
        newContext: ctx,
      };
    }

    case 'SELESAI': {
      const rating = parseInt(message.replace(/\D/g, ''), 10);
      if (!isNaN(rating) && rating >= 1 && rating <= 5) {
        await saveRating(no_wa, rating, undefined, ctx.id_transaksi);
        await updateMemoryAfterOrder(no_wa, ctx, rating);

        if (rating >= 4) {
          enqueueJob('ai_learn', {
            trigger_pattern: ctx.kode_pesanan || 'order_selesai',
            response_template: 'Terima kasih sudah berbelanja!',
            rating,
            no_wa,
          }).catch(() => {});
        }

        const thanks = rating >= 4
          ? `Terima kasih Kak! Rating *⭐${rating}* sangat kami apresiasi 🙏😊`
          : `Terima kasih atas masukannya Kak. Rating *${rating}* akan kami jadikan evaluasi 🙏`;

        return {
          response: `${thanks}\n\nJangan sungkan hubungi kami lagi ya kak! Ada yang bisa kami bantu? 😊`,
          source: 'rule',
          newContext: { step: 'IDLE' },
        };
      }

      return {
        response:
          `Terima kasih sudah berbelanja di *Rumah Keripik* 😊\n\n` +
          `Ketik angka *1-5* untuk rating (1=Kurang puas, 5=Sangat puas) ⭐`,
        source: 'rule',
        newContext: ctx,
      };
    }

    default: {
      return {
        response: 'Ada yang bisa kami bantu lagi kak? Ketik *pesan* untuk memulai pemesanan baru.',
        source: 'rule',
        newContext: { step: 'IDLE' },
      };
    }
  }
}

/**
 * Render order summary text
 */
function showOrderSummary(ctx: OrderContext): { response: string; source: 'rule'; newContext: OrderContext } {
  const cart = ctx.cart || [];
  const belanjaTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const total = belanjaTotal + (ctx.shipping_cost || 0);

  const cartLines = cart.map((item) => {
    const varian = item.varian ? ` (${item.varian})` : '';
    return `- ${item.nama_produk}${varian} x${item.qty} = Rp ${item.subtotal.toLocaleString('id-ID')}`;
  });

  const mapsLine = ctx.maps_link_pengiriman 
    ? `\n📍 *Peta Lokasi:* ${ctx.maps_link_pengiriman}` 
    : '';
  const noHpLine = ctx.no_hp ? `\n📞 *No HP:* ${ctx.no_hp}` : '';

  const response = 
    `📋 *RINGKASAN PESANAN KAKAK:* 📋\n\n` +
    `👤 *Penerima:* ${ctx.nama_penerima}\n` +
    `🏠 *Alamat Kirim:* ${ctx.alamat_pengiriman}${mapsLine}${noHpLine}\n\n` +
    `🛒 *Daftar Keripik:* \n` +
    cartLines.join('\n') +
    `\n\n` +
    `💵 *Total Belanja:* Rp ${belanjaTotal.toLocaleString('id-ID')}\n` +
    `📦 *Ongkos Kirim:* Rp ${(ctx.shipping_cost || 0).toLocaleString('id-ID')}\n` +
    `💰 *TOTAL BAYAR:* *Rp ${total.toLocaleString('id-ID')}*\n\n` +
    `Apakah pesanan di atas sudah benar kak? Ketik *ya* untuk konfirmasi dan mendapatkan info rekening transfer.`;

  return {
    response,
    source: 'rule',
    newContext: ctx,
  };
}

/**
 * Extract product variants from product description
 * Looks for patterns like "Varian: Original, Pedas, Balado"
 */
function extractVariants(deskripsi: string | null): string[] {
  if (!deskripsi) return [];
  const varianMatch = deskripsi.match(/(?:varian|rasa|ukuran)\s*:\s*(.+)/i);
  if (varianMatch) {
    return varianMatch[1].split(/[,;\/]/).map((v) => v.trim()).filter(Boolean);
  }
  return [];
}
