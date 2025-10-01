/**
 * Converts an image to 1024x1024 square format with white padding
 * while preserving all original content and detail
 */
export const convertToSquare = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Create canvas for conversion
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set target dimensions
        const targetSize = 1024;
        canvas.width = targetSize;
        canvas.height = targetSize;

        // Fill with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetSize, targetSize);

        // Calculate dimensions to fit image within canvas while preserving aspect ratio
        const imgAspectRatio = img.naturalWidth / img.naturalHeight;
        
        let drawWidth = targetSize;
        let drawHeight = targetSize;
        let offsetX = 0;
        let offsetY = 0;

        // Add small padding (8px on each side = 16px total reduction)
        const padding = 16;
        const availableSize = targetSize - padding;

        if (imgAspectRatio > 1) {
          // Landscape: fit width, center vertically
          drawWidth = availableSize;
          drawHeight = availableSize / imgAspectRatio;
          offsetX = padding / 2;
          offsetY = (targetSize - drawHeight) / 2;
        } else if (imgAspectRatio < 1) {
          // Portrait: fit height, center horizontally
          drawHeight = availableSize;
          drawWidth = availableSize * imgAspectRatio;
          offsetX = (targetSize - drawWidth) / 2;
          offsetY = padding / 2;
        } else {
          // Square: fit with padding
          drawWidth = availableSize;
          drawHeight = availableSize;
          offsetX = padding / 2;
          offsetY = padding / 2;
        }

        // Draw the image centered with high quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        // Convert canvas to blob with high quality
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to convert canvas to blob'));
            return;
          }

          // Create new File object with same name but updated content
          const convertedFile = new File([blob], file.name, {
            type: 'image/png',
            lastModified: Date.now(),
          });

          resolve(convertedFile);
        }, 'image/png', 1.0);

      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load the image
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Converts a base64 data URL to File object for processing
 */
export const dataUrlToFile = (dataUrl: string, filename: string): File => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
};

/**
 * Converts a File object to base64 data URL
 */
export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to data URL'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Creates a 1024x1024 solid color image from a hex color
 */
export const createSolidColorImage = (hexColor: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Set canvas size to 1024x1024
      canvas.width = 1024;
      canvas.height = 1024;

      // Fill with the solid color
      ctx.fillStyle = hexColor;
      ctx.fillRect(0, 0, 1024, 1024);

      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    } catch (error) {
      reject(error);
    }
  });
};