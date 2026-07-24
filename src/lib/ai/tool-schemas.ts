import { z } from 'zod';

export const searchProductsSchema = z.object({
  query: z.string().min(1, 'Query pencarian tidak boleh kosong').max(200),
  productIds: z.array(z.string()).optional(),
});

export const recommendProductsSchema = z.object({
  message: z.string().min(1).max(500),
});

export const addToCartSchema = z.object({
  productId: z.string().min(1, 'ID produk wajib diisi'),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Jumlah harus lebih dari 0').max(100, 'Jumlah maksimal 100 per item'),
});

export const updateCartItemSchema = z.object({
  itemId: z.string().min(1, 'ID item keranjang wajib diisi'),
  quantity: z.number().int().min(0, 'Jumlah tidak boleh negatif').max(100),
});

export const getCartSchema = z.object({});

export const getPaymentMethodsSchema = z.object({});

export const checkCustomerSessionSchema = z.object({});

export const findOrCreateCustomerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  phone: z.string().min(8, 'Nomor telepon tidak valid').max(20),
});

export const saveCustomerAddressSchema = z.object({
  address: z.string().min(8, 'Alamat terlalu pendek, minta detail lebih lengkap'),
  label: z.string().optional().default('Alamat utama'),
  recipientName: z.string().optional(),
  phone: z.string().optional(),
  lat: z.union([z.string(), z.number()]).optional(),
  lng: z.union([z.string(), z.number()]).optional(),
  landmark: z.string().optional(),
  note: z.string().optional(),
  isDefault: z.boolean().optional().default(true),
});

export const saveLocationSchema = z.object({
  phone: z.string().min(8).optional(),
  lat: z.union([z.string(), z.number()]),
  lng: z.union([z.string(), z.number()]),
  address: z.string().optional(),
  source: z.enum(['manual', 'maps_link']).optional().default('manual'),
  note: z.string().optional(),
});

export const createOrderFromCartSchema = z.object({
  name: z.string().min(2, 'Nama penerima wajib diisi'),
  phone: z.string().min(8, 'Nomor telepon penerima wajib diisi'),
  type: z.enum(['konsumen', 'warung', 'reseller']).optional().default('konsumen'),
  address: z.string().min(8, 'Alamat pengiriman wajib lengkap'),
  addressNote: z.string().optional(),
  mapsLink: z.string().optional(),
  lat: z.union([z.string(), z.number()]).optional(),
  lng: z.union([z.string(), z.number()]).optional(),
  paymentMethodId: z.string().min(1, 'Metode pembayaran wajib dipilih'),
  notes: z.string().max(500).optional(),
});

export const selectPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'ID metode pembayaran wajib diisi'),
});

export const createPaymentInstructionSchema = z.object({
  orderId: z.string().min(1, 'ID pesanan wajib diisi'),
  paymentMethodId: z.string().optional(),
});

export const getOrderStatusSchema = z.object({
  orderId: z.string().min(1, 'ID pesanan wajib diisi'),
});

export const searchKnowledgeBaseSchema = z.object({
  query: z.string().min(1, 'Pertanyaan tidak boleh kosong').max(300),
  topK: z.number().int().positive().max(10).optional().default(3),
});

export const requestAdminHandoffSchema = z.object({
  reason: z.string().min(1).max(300).optional().default('Butuh bantuan admin'),
});

export const toolSchemaRegistry: Record<string, z.ZodTypeAny> = {
  search_products: searchProductsSchema,
  searchProducts: searchProductsSchema,
  recommend_products: recommendProductsSchema,
  recommendProducts: recommendProductsSchema,
  add_to_cart: addToCartSchema,
  addToCart: addToCartSchema,
  update_cart_item: updateCartItemSchema,
  updateCartItem: updateCartItemSchema,
  get_cart: getCartSchema,
  getCart: getCartSchema,
  get_payment_methods: getPaymentMethodsSchema,
  getPaymentMethods: getPaymentMethodsSchema,
  check_customer_session: checkCustomerSessionSchema,
  get_customer_profile: checkCustomerSessionSchema,
  get_customer_addresses: checkCustomerSessionSchema,
  find_or_create_customer: findOrCreateCustomerSchema,
  findOrCreateCustomer: findOrCreateCustomerSchema,
  save_customer_address: saveCustomerAddressSchema,
  saveCustomerAddress: saveCustomerAddressSchema,
  save_location: saveLocationSchema,
  saveLocation: saveLocationSchema,
  create_order_from_cart: createOrderFromCartSchema,
  createOrderFromCart: createOrderFromCartSchema,
  select_payment_method: selectPaymentMethodSchema,
  selectPaymentMethod: selectPaymentMethodSchema,
  create_payment_instruction: createPaymentInstructionSchema,
  createPaymentInstruction: createPaymentInstructionSchema,
  get_order_status: getOrderStatusSchema,
  search_knowledge_base: searchKnowledgeBaseSchema,
  request_admin_handoff: requestAdminHandoffSchema,
  requestAdminHandoff: requestAdminHandoffSchema,
};
