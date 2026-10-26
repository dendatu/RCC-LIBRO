import "server-only";
import QRCode from "qrcode";
import { siteUrl } from "@/lib/env";

/**
 * A scanned copy QR resolves to the copy's catalogue page, which also accepts
 * `?scan=1` so the circulation desk can auto-fill the borrow form.
 */
export function copyUrl(barcode: string) {
  return `${siteUrl}/book/${encodeURIComponent(barcode)}`;
}

export function scanUrl(barcode: string) {
  return `${copyUrl(barcode)}?scan=borrow`;
}

export function borrowerCardUrl(cardNumber: string) {
  return `${siteUrl}/card/${encodeURIComponent(cardNumber)}`;
}

export async function qrDataUrl(payload: string, size = 320) {
  return QRCode.toDataURL(payload, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#2D2D2D", light: "#FFFFFF" },
  });
}

export async function qrPng(payload: string, size = 512) {
  return QRCode.toBuffer(payload, {
    type: "png",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#2D2D2D", light: "#FFFFFF" },
  });
}

/** SVG is used for print sheets so labels stay crisp at any label size. */
export async function qrSvg(payload: string, size = 320) {
  return QRCode.toString(payload, {
    type: "svg",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#2D2D2D", light: "#FFFFFF" },
  });
}
