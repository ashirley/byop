export class VisualiserPixelListener {
  constructor() {
    this.visualiserData = { devices: {} };
    this.visualiserDataBuffer = { devices: {} }; //store the data while it is being updated.
  }

  newDevice() {}

  startedUpdatingDevices(source) {
    this.visualiserDataBuffer.source = source;
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
      x: pixel.x,
      y: pixel.y,
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
