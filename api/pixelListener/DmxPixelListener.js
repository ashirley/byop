import e131 from "e131";

export class DmxPixelListener {
  constructor() {
    this.e131Cache = {};
  }

  newDevice(id, host, pixelCount) {
    if (host) {
      var client = new e131.Client(host);
      var packet = client.createPacket(3 * pixelCount);
      packet.setSourceName("BYOP");
      packet.setUniverse(0x01);

      this.e131Cache[id] = [client, packet];
    }
  }

  startedUpdatingDevices(source) {}

  updatePixelColor(deviceId, pixelIndex, r, g, b) {
    if (deviceId in this.e131Cache) {
      const [_, packet] = this.e131Cache[deviceId];
      const slotsData = packet.getSlotsData();

      slotsData[pixelIndex * 3] = r * 255;
      slotsData[pixelIndex * 3 + 1] = g * 255;
      slotsData[pixelIndex * 3 + 2] = b * 255;
    }
  }

  finishedUpdatingDevice(deviceId) {
    if (deviceId in this.e131Cache) {
      const [client, packet] = this.e131Cache[deviceId];
      client.send(packet);
    }
  }

  finishedUpdatingDevices() {}
}
