export class Device {
  constructor(id, x, y, ipAddr, pixels) {
    this.id = id;
    this.location = { x, y };
    this.ipAddr = ipAddr;
    this.pixels = Device.parsePixels(pixels);
    const allX = this.pixels.map((p) => p.x);
    const allY = this.pixels.map((p) => p.y);
    this.minX = Math.min(...allX);
    this.maxX = Math.max(...allX);
    this.minY = Math.min(...allY);
    this.maxY = Math.max(...allY);
  }

  getPixels() {
    return this.pixels;
  }

  static parsePixels(pixels) {
    if (pixels == null) {
      return [new PixelLocation(0, 0)];
    }
    if (Array.isArray(pixels)) {
      const retval = [];
      for (const [pixelIndex, pixel] of pixels.entries()) {
        if (Array.isArray(pixel)) {
          if (pixel.length === 2) {
            retval.push(new PixelLocation(pixel[0], pixel[1]));
          } else if (pixel.length === 3) {
            console.log(
              `Ignoring the 3rd dimension for pixel ${pixelId} as we only map in 2D`
            );
            retval.push(new PixelLocation(pixel[0], pixel[1]));
          } else {
            throw new Error(`Couldn't parse pixel ${pixelIndex} (${pixel})`);
          }
        } else if (typeof pixel === "object" && "x" in pixel && "y" in pixel) {
          if ("z" in pixel) {
            console.log(
              `Ignoring the 3rd dimension for pixel ${pixelId} as we only map in 2D`
            );
          }
          retval.push(new PixelLocation(pixel.x, pixel.y));
        } else {
          //TODO: parse strings?

          throw new Error(
            `Couldn't parse pixel ${pixelIndex} (${typeof pixel} - ${pixel})`
          );
        }
      }
      return retval;
    }

    //TODO: parse strings?
    throw new Error(`Couldn't parse pixels (${typeof pixels} - ${pixels})`);
  }
}

class PixelLocation {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}
