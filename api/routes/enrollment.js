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

  if (fixId === "byopPixelCount") {
    //This doesn't require confirmation (as it does nothing until you press save on the next screen) so shortcut
    if (req.query.fixData != null) {
      res.redirect(`/devices/${deviceId}/edit?pixelCount=${req.query.fixData}`);
      return;
    } else {
      errorMessage =
        "Error applying byopPixelCount fix: target pixelCount must be supplied as a 'fixData' query parameter";
    }
  }

  var fixDescription = {
    liveMode: "Change live mode settings to match BYOP expectations",
    wledPixelCount: "Change wled pixel output settings",
    byopPixelCount:
      "Edit the device in BYOP to match the pixel count from wled",
    wledPixelCountAndMode: "Change wled pixel output and live mode settings",
    byopPixelCountAndMode:
      "Edit the device in BYOP to match the pixel count from wled but chnage the wled live mode setting too",
  }[fixId];

  var errorMessage =
    fixDescription == undefined
      ? "Unknown fix, nothing could be changed"
      : null;

  res.render("deviceFix", {
    device,
    fix: { id: fixId, description: fixDescription, fixData: req.query.fixData },
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
    case "wledPixelCountAndMode":
      try {
        await req.devices.fixLiveMode(deviceId);
        await req.devices.fixWledPixelCount(deviceId);
      } catch (e) {
        errorMessage = "Error applying wledPixelCount fix: " + e;
      }
      break;
    case "byopPixelCountAndMode":
      try {
        await req.devices.fixLiveMode(deviceId);
        if (req.query.fixData != null) {
          res.redirect(
            `/devices/${deviceId}/edit?pixelCount=${req.query.fixData}`
          );
          return;
        } else {
          errorMessage =
            "Error applying byopPixelCount fix: target pixelCount must be supplied as a 'fixData' query parameter";
        }
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

router.get("/devices/:deviceId/edit", function (req, res, next) {
  const id = req.params.deviceId;
  const device = req.devices.getDeviceById(id);

  res.render("newdevice", {
    existing: {
      x: device.x,
      y: device.y,
      host: device.host,
      pixelCount: req.query.pixelCount || device.pixels.length,
      multiplePixels: (req.query.pixelCount || device.pixels.length) > 1,
      pixelJSON: JSON.stringify(device.pixels.map((d) => ({ x: d.x, y: d.y }))),
    },
  });
});

router.post("/devices/:deviceId/edit", function (req, res, next) {
  req.devices.updateDevice(
    req.params.deviceId,
    Number(req.body.x),
    Number(req.body.y),
    JSON.parse(
      req.body.drawnPixelLocations || req.body.pixelLocations || "[[0,0]]"
    )
  );
  res.redirect("/devices/" + req.params.deviceId);
});

export default router;
