import bwipjs from 'bwip-js';

/** Render a scannable Code128 barcode as a PNG data URI for embedding in HTML/PDF. */
export async function barcodePngDataUri(text: string): Promise<string> {
  const normalized = text.trim();
  if (!normalized) return '';

  try {
    const png = await new Promise<Buffer>((resolve, reject) => {
      bwipjs.toBuffer(
        {
          bcid: 'code128',
          text: normalized,
          scale: 2,
          height: 10,
          includetext: true,
          textsize: 9,
          textxalign: 'center',
          paddingwidth: 4,
          paddingheight: 2,
        },
        (err, buffer) => (err ? reject(err) : resolve(buffer)),
      );
    });
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return '';
  }
}
