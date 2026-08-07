'use client';
// Lightweight QR rendered as an <img> from a free QR image service, with the
// verification URL encoded. Keeps the bundle small and adds no dependency.
// If the service is unavailable the URL is still shown as text underneath.
export default function QrCode({ value, size = 120 }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(value)}`;
  return (
    <img src={src} alt="Verification QR code" width={size} height={size}
      style={{ width: size, height: size, background: '#fff', borderRadius: 8 }} />
  );
}
