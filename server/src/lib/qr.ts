import QRCode from "qrcode"

export async function qrSvg(url: string, size = 512): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: {
      dark: "#1c1917",
      light: "#ffffff",
    },
  })
}
