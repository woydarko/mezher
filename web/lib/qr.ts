import QRCode from "qrcode";

/** SVG markup of a QR code for `url`, ink on paper (globals.css colours), scannable from a phone. */
export function qrSvg(url: string): Promise<string> {
  if (!url) return Promise.reject(new Error("nothing to encode"));
  // error level M survives a slightly blurry phone photo of a screen; margin 2 keeps a quiet zone
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#1F1B16", light: "#FFFDF7" },
  });
}
