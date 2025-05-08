import express from "express";
var router = express.Router();

function page(object, start, num) {
  return Object.keys(object)
    .slice(start, start + num)
    .reduce(function (acc, key) {
      acc[key] = object[key];
      return acc;
    }, {});
}

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

router.get("/devices", function (req, res, next) {
  res.render("devices", {
    //TODO: proper paging, not just static top 10
    registeredDevices: page(req.devices.getRegisteredDevices(), 0, 10),
  });
});

router.post("/devices/new", function (req, res, next) {
  const newId = req.devices.registerDevice(
    Number(req.body.x),
    Number(req.body.y),
    req.body.host,
    JSON.parse(
      req.body.drawnPixelLocations || req.body.pixelLocations || "[[0,0]]"
    )
  );
  res.redirect("/devices/" + newId);
});

router.get("/devices/new", function (req, res, next) {
  const unregDevices = req.devices.getUnregisteredDevices();
  const latestUnregDevices = Object.entries(unregDevices)
    .slice(-10)
    .map(([k, v]) => Object.assign({}, v, { name: k }));

  res.render("newdevice", {
    unregisteredDevices: latestUnregDevices,
    wifiSsid: process.env.WIFI_SSID,
    wifiPassword: process.env.WIFI_PASSWORD,
  });
});

router.get("/devices/:deviceId", function (req, res, next) {
  const id = req.params.deviceId;
  const device = req.devices.getDeviceById(id);
  res.render("device", { device });
});

router.get("/devices/:deviceId/fix", function (req, res, next) {
  const deviceId = req.params.deviceId;
  const fixId = req.query.fixId;
  const device = req.devices.getDeviceById(deviceId);

  var fixDescription;
  var errorMessage;
  switch (fixId) {
    case "liveMode":
      fixDescription = "Change live mode settings to match BYOP expectations";
      break;
    case "wledPixelCount":
      fixDescription = "Change wled pixel output settings";
      break;
    default:
      errorMessage = "Unknown fix, nothing could be changed";
  }

  res.render("deviceFix", {
    device,
    fix: { id: fixId, description: fixDescription },
    errorMessage,
  });
});

router.post("/devices/:deviceId/fix", async function (req, res, next) {
  const deviceId = req.params.deviceId;
  const fixId = req.query.fixId;
  const device = req.devices.getDeviceById(deviceId);

  var errorMessage;
  switch (fixId) {
    case "liveMode":
      try {
        await req.devices.fixLiveMode(deviceId);
      } catch (e) {
        errorMessage = "Error applying liveMode fix: " + e;
      }
      break;
    case "wledPixelCount":
      try {
        await req.devices.fixWledPixelCount(deviceId);
      } catch (e) {
        errorMessage = "Error applying wledPixelCount fix: " + e;
      }
      break;
    default:
      errorMessage = "Unknown fix, nothing could be changed";
  }

  if (errorMessage) {
    res.render("deviceFix", {
      device,
      fix: { id: fixId },
      errorMessage,
    });
  } else {
    res.redirect("/devices/" + deviceId);
  }
});

export default router;
