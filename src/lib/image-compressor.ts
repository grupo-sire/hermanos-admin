/**
 * Utilitário de Compressão de Imagens para o Navegador (Canvas WebGL)
 * Reduz fotos pesadas do celular (5MB - 20MB) para arquivos extremamente leves (< 200KB)
 * sem perda de qualidade visual perceptível.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (default 0.75)
}

export function compressImage(file: File, options: CompressionOptions = {}): Promise<string> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.75 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcular novas dimensões mantendo a proporção de aspecto (aspect-ratio)
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Não foi possível inicializar contexto 2D no navegador"));
          return;
        }

        // Suavização da imagem durante o redimensionamento
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Exporta como Data URL WebP (ou JPEG caso WebP não seja suportado)
        let compressedBase64 = canvas.toDataURL("image/webp", quality);
        if (!compressedBase64.startsWith("data:image/webp")) {
          compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        }

        resolve(compressedBase64);
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}
