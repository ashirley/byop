import { sampleDevices, targetFps as demoTargetFps } from "@byop/demoData";

export const loadDemoData = (devices) => {
  console.log("Loading DemoData");
  const sampleDevicesObj = sampleDevices();
  for (const [_, device] of Object.entries(sampleDevicesObj.devices)) {
    devices.registerDevice(
      device.x,
      device.y,
      null,
      Object.values(device.pixels).map((p) => ({ x: p.x, y: p.y }))
    );
  }

  // devices.registerDevice(1, 0, 0, "192.168.1.97");
  // devices.registerDevice(2, 137500, 62500, "192.168.1.98", [
  //   [0, 0],
  //   { x: 625, y: 625 },
  // ]); //example of 2 ways of specifying pixel position
};
export const targetFps = demoTargetFps;
