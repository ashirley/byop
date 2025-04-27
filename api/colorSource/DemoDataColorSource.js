import { spatialRainbow } from "@byop/demoData";

export class DemoDataColorSource {
  getSource() {
    return "demo-api";
  }

  calculate(timestamp, pixel, deviceId, pixelIndex) {
    const c = spatialRainbow(timestamp, pixel, deviceId, pixelIndex);

    // const t = (Date.now() % 5000) / 5000;
    // if (deviceId == 2 && (t * 1000) % 5 == 1) {
    //   console.log(
    //     "localData",
    //     deviceId,
    //     pixelIndex,
    //     phase,
    //     t,
    //     gX,
    //     gY,
    //     lX,
    //     lY,
    //     localWeight,
    //     h,
    //     s,
    //     l,
    //     r,
    //     g,
    //     b
    //   );
    // }

    return c;
  }

  async shutdown() {
    return Promise.resolve();
  }
}
