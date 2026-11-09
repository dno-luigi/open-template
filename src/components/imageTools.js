// Pictures added to a document stay on this device.
// The picture is shrunk and saved as a JPEG inside the document, so it works in the preview,
// the 3D paper, the saved template and the PDF. It is never sent anywhere.

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_SIDE = 900;
const MAX_BYTES = 25 * 1024 * 1024;

export async function prepareImage(file, maxSide = MAX_SIDE) {
  if (!file || !String(file.type).startsWith("image/")) {
    throw new Error("Choose a picture file: JPG, PNG, WebP or GIF.");
  }
  if (file.size > MAX_BYTES) throw new Error("That picture is too big. Choose one under 25 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That picture could not be read. Try a JPG or PNG."));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const src = canvas.toDataURL("image/jpeg", 0.82);
    return { src, width, height, name: file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Image" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// base64 data URL -> binary string (one char per byte), for the PDF writer.
export function dataUrlToBinary(src) {
  return atob(String(src).split(",")[1] || "");
}
