/**
 * Client-Side Image Compression Utility
 *
 * Compresses document image files (JPEG, PNG) using HTML5 Canvas
 * down to approximately 200-300 KB before cloud upload to save bandwidth and storage.
 */

/**
 * บีบอัดรูปภาพเอกสารฝั่ง Client-side
 *
 * @param file ไฟล์ภาพต้นฉบับ
 * @param maxWidth ความกว้างสูงสุด (ค่าเริ่มต้น: 1200px)
 * @param maxHeight ความสูงสูงสุด (ค่าเริ่มต้น: 1200px)
 * @param quality คุณภาพรูปภาพ (ค่าเริ่มต้น: 0.75)
 * @returns ไฟล์ใหม่ที่ผ่านการบีบอัด
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<File> {
  // หากไม่ใช่ประเภทรูปภาพ ไม่ทำการบีบอัดและส่งค่าคืนทันที
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio
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

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context could not be retrieved'));
        }

        // Draw resized image on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with controlled quality factor
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas serialization returned null blob'));
            }

            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            console.log(
              `[ImageCompress] Compressed from ${(file.size / 1024).toFixed(1)} KB ` +
              `to ${(compressedFile.size / 1024).toFixed(1)} KB`
            );

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}
