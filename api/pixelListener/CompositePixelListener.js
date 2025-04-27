export class CompositePixelListener {
  constructor(...args) {
    this.delegates = args;
  }

  newDevice(id, host, pixelCount) {
    this.delegates.forEach((d) => d.newDevice(id, host, pixelCount));
  }

  startedUpdatingDevices(source) {
    this.delegates.forEach((d) => d.startedUpdatingDevices(source));
  }

  updatePixelColor(deviceId, pixelIndex, r, g, b, device, pixel) {
    this.delegates.forEach((d) =>
      d.updatePixelColor(deviceId, pixelIndex, r, g, b, device, pixel)
    );
  }

  finishedUpdatingDevice(deviceId) {
    this.delegates.forEach((d) => d.finishedUpdatingDevice(deviceId));
  }

  finishedUpdatingDevices() {
    this.delegates.forEach((d) => d.finishedUpdatingDevices());
  }
}
