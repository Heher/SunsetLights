const { setPorch } = require('../Porch/setPorch');
const { checkAndSetLights } = require('./checkLights');
const { getSunsetTimes } = require('../utils/suntimes');

const sunTimes = getSunsetTimes();

const runPrograms = async () => {
  // await checkAndSetLights(sunTimes);
  await setPorch(sunTimes);
};

runPrograms();
