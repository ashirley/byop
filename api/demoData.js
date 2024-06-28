export const loadDemoData = (devices) => {
  devices.addDevice(1, 0, 0, "192.168.1.97");
  devices.addDevice(2, 137500, 62500, "192.168.1.98", [
    [0, 0],
    { x: 625, y: 625 },
  ]); //example of 2 ways of specifying pixel position
};
