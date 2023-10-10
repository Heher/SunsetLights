import SunCalc from 'suncalc';
import { DateTime } from 'luxon';
import { v3 } from 'node-hue-api';
import dotenv from 'dotenv';
import type { model } from '@peter-murray/hue-bridge-model';

import { findBridgeAndApi } from './api';
import { Api } from 'node-hue-api/dist/esm/api/Api';

type LightsType = model.Light | model.Luminaire | model.Lightsource;

dotenv.config();

const LightState = v3.lightStates.LightState;

let api: Api | null = null;

const lightSettings = {
  day: {
    bri: 254,
    xy: [0.4586, 0.4104]
  },
  night: {
    bri: 242,
    xy: [0.5266, 0.4133]
  }
};

async function setApi(): Promise<Api> {
  const newApi = await findBridgeAndApi();
  api = newApi;

  return newApi;
}

async function getApi(): Promise<Api> {
  let instance = api;

  if (!instance) {
    instance = await setApi();
  }

  return instance;
}

async function lightsAreOff(): Promise<{ allOff: boolean; lights: LightsType[] }> {
  const apiInstance = await getApi();
  const lights = await apiInstance.lights.getAll();

  return {
    allOff: lights.every((light) => !light.data.state.on),
    lights: lights.filter((light) => light.data.state.on)
  };
}

type SunsetTimes = {
  sunset: DateTime;
  thirtyBefore: DateTime;
  now: DateTime;
};

function getSunsetTimes(): SunsetTimes {
  if (!process.env.SUNSET_LAT || !process.env.SUNSET_LONG) {
    throw new Error('Sunset latitude and longitude not set in .env file');
  }

  const sunTimes = SunCalc.getTimes(
    new Date(),
    parseFloat(process.env.SUNSET_LAT),
    parseFloat(process.env.SUNSET_LONG)
  );
  const convertedTime = DateTime.fromJSDate(sunTimes.sunset);
  const thirtyBefore = convertedTime.minus({ minutes: 30 });
  const now = DateTime.local();

  return {
    sunset: convertedTime,
    thirtyBefore,
    now
  };
}

async function transitionLights(times: SunsetTimes, lights: LightsType[]) {
  const apiInstance = await getApi();
  const briDiff = lightSettings.day.bri - lightSettings.night.bri;
  const xDiff = lightSettings.night.xy[0] - lightSettings.day.xy[0];
  const yDiff = lightSettings.night.xy[1] - lightSettings.day.xy[1];

  const briStep = briDiff / 30;
  const xStep = xDiff / 30;
  const yStep = yDiff / 30;

  const { minutes } = times.now.diff(times.thirtyBefore, 'minutes').toObject();

  if (minutes === null || minutes === undefined) {
    throw new Error('Minutes is null or undefined');
  }

  const newState = new LightState()
    .bri(lightSettings.day.bri - Math.floor(briStep * minutes))
    .xy(lightSettings.day.xy[0] + xStep * minutes, lightSettings.day.xy[1] + yStep * minutes);

  lights.forEach(async (light) => {
    const lightID = light.data.id;

    await apiInstance.lights.setLightState(lightID, newState);
  });
}

export async function checkAndSetLights() {
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
}
