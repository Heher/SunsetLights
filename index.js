const SunCalc = require('suncalc');
const { DateTime } = require('luxon');
const express = require('express');
const v3 = require('node-hue-api').v3;

const { findBridgeAndApi } = require('./api');

const LightState = v3.lightStates.LightState;

let api;

const port = 3000;

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

const app = express();

const setApi = async () => {
  if (!api) {
    api = await findBridgeAndApi();
  }

  return;
};

const getLight = async () => {
  await setApi();

  const light = await api.lights.getLightByName("Ceiling 2");

  const {bri, xy} = light._data.state;

  console.log(bri, xy);

  return light;
};

const lightsAreOff = async () => {
  await setApi();
  const lights = await api.lights.getAll();
  //console.log(lights);

  //let lightsOn = false;

  return {
    allOff: lights.every(light => !light._data.state.on),
    lights
  };
}

const setAllLights = async (daySection) => {
  await setApi();

  const lights = await api.lights.getAll();

  const settings = lightSettings[daySection];

  const newState = new LightState().bri(settings.bri).xy(settings.xy);

  lights.forEach(async (light) => {
    const lightID = light._data.id;

    await api.lights.setLightState(lightID, newState);
  });
}

const turnGreen = async () => {
  const light = await getLight();
  const lightID = light._data.id;

  const newState = new LightState().xy(0.274, 0.506);

  await api.lights.setLightState(lightID, newState);
};

const getSunsetTimes = () => {
  const sunTimes = SunCalc.getTimes(new Date(), 30.255975, -97.762204);
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

  const { minutes } = times.now.diff(times.thirtyBefore, 'minutes').toObject()

  const newState = new LightState().bri(lightSettings.day.bri - (briStep * minutes)).xy(lightSettings.day.xy[0] + (xStep * minutes), lightSettings.day.xy[1] + (yStep * minutes));

  lights.forEach(async (light) => {
    const lightID = light._data.id;

    await api.lights.setLightState(lightID, newState);
  };
};

const checkAndSetLights = async () => {
  const result = await lightsAreOff();
  console.log(result.allOff);

  if (result.allOff) {
    return;
  }

  const sunTimes = getSunsetTimes();
  const day = sunTimes.now < sunTimes.thirtyBefore;

  if (day) {
    return;
  }

  if (sunTimes.now > sunTimes.sunset) {
    await setAllLights('night');
  } else {
    await transitionLights(sunTimes, lights);
  }
};

app.get('/sunset', async (req, res) => {
  await setAllLights('night');
  res.json({time: convertedTime.c});
});

app.get('/day', async (req, res) => {
  await setAllLights('day');
  res.json({time: convertedTime.c});
});

app.get('/green', async (req, res) => {
  await turnGreen();
  res.json({success: true});
});

app.get('/check', async (req, res) => {
  await checkAndSetLights();
  res.json({result: 'checked'});
});

app.listen(port, () => console.log(`Listening on port ${port}`));
