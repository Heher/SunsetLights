const v3 = require('node-hue-api').v3;
const fs = require('fs');

const { findBridgeAndApi } = require('../utils/api');

const LightState = v3.lightStates.LightState;

let api;

const lightSettings = {
  day: {
    bri: 254,
    xy: [ 0.4586, 0.4104 ]
  },
  night: {
    bri: 242,
    xy: [ 0.5266, 0.4133 ]
  }
};

const briDiff = lightSettings.day.bri - lightSettings.night.bri;
const xDiff = lightSettings.night.xy[0] - lightSettings.day.xy[0];
const yDiff = lightSettings.night.xy[1] - lightSettings.day.xy[1];

const briStep = briDiff / 30;
const xStep = xDiff / 30;
const yStep = yDiff / 30;

const setApi = async () => {
  if (!api) {
    api = await findBridgeAndApi();
  }

  return;
};

const lightsAreOff = async () => {
  await setApi();
  const lights = await api.lights.getAll();

  const excludedLightsFile = fs.readFileSync('/home/pi/Hue/SunsetLights/excluded-lights.json');
  const excludedLights = JSON.parse(excludedLightsFile);

  const includedLights = lights.filter((light) => {
    return !excludedLights.includes(light.data.name)
  });

  return {
    allOff: includedLights.every(light => !light.data.state.on),
    lights: includedLights.filter(light => light.data.state.on)
  };
}


const transitionLights = async (times, lights) => {
  await setApi();

  const { minutes } = times.now.diff(times.sunset.thirtyBefore, 'minutes').toObject();

  const newState = new LightState().bri(lightSettings.day.bri - (Math.floor(briStep * minutes))).xy(lightSettings.day.xy[0] + (xStep * minutes), lightSettings.day.xy[1] + (yStep * minutes));

  lights.forEach(async (light) => {
    const lightID = light.data.id;

    await api.lights.setLightState(lightID, newState);
  });
};

const checkAndSetLights = async (sunTimes) => {
  await setApi();

  const result = await lightsAreOff();

  if (result.allOff) {
    return;
  }

  const day = sunTimes.now < sunTimes.sunset.thirtyBefore;

  if (day) {
    return;
  }

  if (sunTimes.now > sunTimes.sunset.time) {
    return;
  } else {
    await transitionLights(sunTimes, result.lights);
  }
};

module.exports = { checkAndSetLights };
