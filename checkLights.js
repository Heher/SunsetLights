const SunCalc = require('suncalc');
const { DateTime } = require('luxon');
const v3 = require('node-hue-api').v3;
const dotenv = require('dotenv');

const { findBridgeAndApi } = require('./api');

dotenv.config();

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

const setApi = async () => {
  if (!api) {
    api = await findBridgeAndApi();
  }

  return;
};

const lightsAreOff = async () => {
  await setApi();
  const lights = await api.lights.getAll();

  return {
    allOff: lights.every(light => !light.data.state.on),
    lights: lights.filter(light => light.data.state.on)
  };
}

const getSunsetTimes = () => {
  const sunTimes = SunCalc.getTimes(new Date(), process.env.SUNSET_LAT, process.env.SUNSET_LONG);
  const convertedTime = DateTime.fromJSDate(sunTimes.sunset);
  const thirtyBefore = convertedTime.minus({minutes: 30});
  const now = DateTime.local();

  return {
    sunset: convertedTime,
    thirtyBefore,
    now
  };
};

const transitionLights = async (times, lights) => {
  await setApi();
  const briDiff = lightSettings.day.bri - lightSettings.night.bri;
  const xDiff = lightSettings.night.xy[0] - lightSettings.day.xy[0];
  const yDiff = lightSettings.night.xy[1] - lightSettings.day.xy[1];

  const briStep = briDiff / 30;
  const xStep = xDiff / 30;
  const yStep = yDiff / 30;

  const { minutes } = times.now.diff(times.thirtyBefore, 'minutes').toObject();

  const newState = new LightState().bri(lightSettings.day.bri - (Math.floor(briStep * minutes))).xy(lightSettings.day.xy[0] + (xStep * minutes), lightSettings.day.xy[1] + (yStep * minutes));

  lights.forEach(async (light) => {
    const lightID = light.data.id;

    await api.lights.setLightState(lightID, newState);
  });
};

const checkAndSetLights = async () => {
  await setApi();

  const result = await lightsAreOff();

  if (result.allOff) {
    return;
  }

  const sunTimes = getSunsetTimes();
  const day = sunTimes.now < sunTimes.thirtyBefore;

  if (day) {
    return;
  }

  if (sunTimes.now > sunTimes.sunset) {
    return;
  } else {
    await transitionLights(sunTimes, result.lights);
  }
};

module.exports = { checkAndSetLights };
