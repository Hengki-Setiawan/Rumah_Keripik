export type ProductPlaceholder = {
  id: string;
  match: string[];
  url: string;
  alt: string;
  sourceName: 'Pexels' | 'Pixabay';
  sourceUrl: string;
  temporary: true;
};

export type PlaceholderProductInput = {
  nama_produk: string;
  deskripsi?: string | null;
  kategori_nama?: string | null;
};

const placeholders: ProductPlaceholder[] = [
  {
    id: 'spicy-chips',
    match: ['pedas', 'balado', 'cabai', 'sambal', 'chili', 'hot'],
    url: 'https://images.pexels.com/photos/1893556/pexels-photo-1893556.jpeg?auto=compress&cs=tinysrgb&w=900',
    alt: 'Keripik pedas dengan bumbu merah',
    sourceName: 'Pexels',
    sourceUrl: 'https://www.pexels.com/photo/photo-of-potato-chips-1893556/',
    temporary: true,
  },
  {
    id: 'banana-chips',
    match: ['pisang', 'banana'],
    url: 'https://images.pexels.com/photos/5945755/pexels-photo-5945755.jpeg?auto=compress&cs=tinysrgb&w=900',
    alt: 'Keripik pisang renyah',
    sourceName: 'Pexels',
    sourceUrl: 'https://www.pexels.com/search/banana%20chips/',
    temporary: true,
  },
  {
    id: 'original-cassava',
    match: ['singkong', 'cassava', 'ubi', 'original', 'asin', 'gurih'],
    url: 'https://images.pexels.com/photos/4110251/pexels-photo-4110251.jpeg?auto=compress&cs=tinysrgb&w=900',
    alt: 'Keripik singkong original gurih',
    sourceName: 'Pexels',
    sourceUrl: 'https://www.pexels.com/search/chips/',
    temporary: true,
  },
  {
    id: 'onion-garlic',
    match: ['bawang', 'bawang putih', 'bawang merah'],
    url: 'https://images.pexels.com/photos/7232373/pexels-photo-7232373.jpeg?auto=compress&cs=tinysrgb&w=900',
    alt: 'Keripik bawang putih wangi',
    sourceName: 'Pexels',
    sourceUrl: 'https://www.pexels.com/search/onion/',
    temporary: true,
  },
  {
    id: 'mix-flavor',
    match: ['mix', 'campur', 'bumbu', 'varias'],
    url: 'https://images.pexels.com/photos/16566760/pexels-photo-16566760.jpeg?auto=compress&cs=tinysrgb&w=900',
    alt: 'Aneka keripik campur bumbu',
    sourceName: 'Pexels',
    sourceUrl: 'https://www.pexels.com/search/snack%20mix/',
    temporary: true,
  },
  {
    id: 'bundle-snacks',
    match: ['paket', 'bundle', 'hemat', 'oleh-oleh', 'hampers', 'keluarga'],
    url: 'https://images.pexels.com/photos/1028599/pexels-photo-1028599.jpeg?auto=compress&cs=tinysrgb&w=900',
    alt: 'Paket camilan keluarga',
    sourceName: 'Pexels',
    sourceUrl: 'https://www.pexels.com/search/snacks/',
    temporary: true,
  },
  {
    id: 'cassava-fry',
    match: ['keju', 'jagung', 'manis'],
    url: 'https://images.pexels.com/photos/4197845/pexels-photo-4197845.jpeg?auto=compress&cs=tinysrgb&w=900',
    alt: 'Keripik singkong keju',
    sourceName: 'Pexels',
    sourceUrl: 'https://www.pexels.com/search/chips/',
    temporary: true,
  },
];

export const defaultProductPlaceholder: ProductPlaceholder = {
  id: 'default-snack-bowl',
  match: [],
  url: 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=900',
  alt: 'Aneka camilan renyah Rumah Keripik',
  sourceName: 'Pexels',
  sourceUrl: 'https://www.pexels.com/photo/close-up-photo-of-potato-chips-1583884/',
  temporary: true,
};

export function getProductPlaceholder(product: PlaceholderProductInput): ProductPlaceholder {
  const haystack = `${product.nama_produk} ${product.deskripsi || ''} ${product.kategori_nama || ''}`.toLowerCase();
  return placeholders.find((placeholder) => placeholder.match.some((keyword) => haystack.includes(keyword))) || defaultProductPlaceholder;
}
