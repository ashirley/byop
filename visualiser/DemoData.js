import { sampleDevices, spatialRainbow, targetFps } from "@byop/demodata";

export const pixels = (updated) => {
  const { devices } = sampleDevices();

  //update on an interval
  setInterval(() => {
    const timestamp = performance.now();
    // console.log(typeof devices, devices);
    for (const [_, device] of Object.entries(devices)) {
      for (const [_, pixel] of Object.entries(device.pixels)) {
        const c = spatialRainbow(timestamp, pixel);

        pixel.h = c.h;
        pixel.s = c.s;
        pixel.l = c.l;
        pixel.r = c.r;
        pixel.g = c.g;
        pixel.b = c.b;
      }
    }
    updated(devices);
  }, 1000 / targetFps);

  updated(devices);
};
