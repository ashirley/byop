export class VisualiserPixelListener {
  constructor() {
    this.visualiserData = { devices: {} };
    this.visualiserDataBuffer = { devices: {} }; //store the data while it is being updated.
  }

  newDevice() {}

  startedUpdatingDevices(source, minX, minY, maxX, maxY) {
    this.visualiserDataBuffer.source = source;
    this.visualiserDataBuffer.field = {minX, minY, maxX, maxY}
  }

  updatePixelColor(deviceId, pixelIndex, r, g, b, device, pixel) {
    if (!(deviceId in this.visualiserDataBuffer.devices)) {
      this.visualiserDataBuffer.devices[deviceId] = {
        x: device.x,
        y: device.y,
        minX: device.minX,
        maxX: device.maxX,
        minY: device.minY,
        maxY: device.maxY,
        pixels: {},
      };
    }
    this.visualiserDataBuffer.devices[deviceId]["pixels"][pixelIndex] = {
      lX: pixel.lX,
      lY: pixel.lY,
      r,
      g,
      b,
    };
  }

  finishedUpdatingDevice() {}

  finishedUpdatingDevices() {
    //swap the buffers to atomically update all the values.
    const tmp = this.visualiserData;
    this.visualiserData = this.visualiserDataBuffer;
    this.visualiserDataBuffer = tmp;
  }
}
