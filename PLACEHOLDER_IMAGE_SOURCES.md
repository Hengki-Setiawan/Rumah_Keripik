# Placeholder Image Sources

This file documents temporary public placeholder images used by the public ordering storefront.

These images are not final Rumah Keripik product photos. Real product images uploaded from the admin dashboard override these placeholders automatically.

## Current Registry

Source file:

```txt
src/lib/product-placeholders.ts
```

## Sources

| ID | Usage | Source | Source URL | Notes |
| --- | --- | --- | --- | --- |
| `spicy-chips` | Spicy/balado/chili product fallback | Pexels | https://www.pexels.com/photo/photo-of-potato-chips-1893556/ | Temporary. Replace with real spicy Rumah Keripik product photo when available. |
| `banana-chips` | Banana chips product fallback | Pexels | https://www.pexels.com/search/banana%20chips/ | Temporary. Replace with real banana chips photo when available. |
| `cassava-chips` | Cassava/singkong product fallback | Pexels | https://www.pexels.com/search/chips/ | Temporary. Replace with real cassava chips photo when available. |
| `bundle-snacks` | Paket/bundle/oleh-oleh fallback | Pexels | https://www.pexels.com/search/snacks/ | Temporary. Replace with real bundle or packaging photo when available. |
| `default-snack-bowl` | Default product and hero fallback | Pexels | https://www.pexels.com/photo/close-up-photo-of-potato-chips-1583884/ | Temporary. Replace with brand/product lifestyle image when available. |

## License Notes

Pexels images can be used for free and attribution is not required, but these images should still be treated as temporary placeholders.

Avoid selecting placeholder images that show competing brand packaging, visible trademarks, or identifiable people.

## Replacement Workflow

Preferred production replacement path:

```txt
1. Select 8-12 warm, neutral snack/keripik placeholder images.
2. Upload them to Cloudinary folder `rumah-keripik/placeholders`.
3. Replace remote URLs in `src/lib/product-placeholders.ts` with Cloudinary URLs or public IDs.
4. Keep this documentation updated with original source links.
5. Replace placeholders with real Rumah Keripik product photos from the admin dashboard when available.
```

Do not scatter placeholder URLs directly inside JSX components.
