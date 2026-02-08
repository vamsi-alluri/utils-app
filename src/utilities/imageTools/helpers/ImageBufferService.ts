// Service for managing shared image buffer between tools
export interface BufferedImage {
  id: string;
  dataUrl: string;
  filename: string;
  timestamp: number;
}

const BUFFER_KEY = "image_tools_buffer";

export const ImageBufferService = {
  // Add image to buffer
  addToBuffer(dataUrl: string, filename: string): void {
    const buffer = this.getBuffer();
    const newImage: BufferedImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dataUrl,
      filename,
      timestamp: Date.now(),
    };
    buffer.push(newImage);
    localStorage.setItem(BUFFER_KEY, JSON.stringify(buffer));
  },

  // Get all buffered images
  getBuffer(): BufferedImage[] {
    const data = localStorage.getItem(BUFFER_KEY);
    return data ? JSON.parse(data) : [];
  },

  // Clear buffer
  clearBuffer(): void {
    localStorage.removeItem(BUFFER_KEY);
  },

  // Remove specific image
  removeFromBuffer(id: string): void {
    const buffer = this.getBuffer().filter((img) => img.id !== id);
    localStorage.setItem(BUFFER_KEY, JSON.stringify(buffer));
  },

  // Get buffer count
  getBufferCount(): number {
    return this.getBuffer().length;
  },
};
