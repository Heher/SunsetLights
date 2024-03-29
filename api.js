const nodeHue = require('node-hue-api');
const dotenv = require('dotenv');
const dotenvParseVariables = require('dotenv-parse-variables');
const fs = require("fs");
const os = require("os");

const env = dotenv.config({ path: '/home/pi/Hue/SunsetLights/.env' });

const updateEnv = (keyName, value) => {
  const variables = dotenvParseVariables(env.parsed);

  variables[keyName] = value;

  let variableArray = [];

  Object.keys(variables).forEach(key => {
    variableArray.push(`${key}=${variables[key]}`);
  });

  fs.writeFileSync("/home/pi/Hue/SunsetLights/.env", variableArray.join(os.EOL));
}

const createNewUser = async (host) => {
  const appName = 'node-hue';
  const deviceName = 'home-server';

  const unauthenticatedApi = await v3.api.createLocal(host).connect();

  let createdUser;

  try {
    createdUser = await unauthenticatedApi.users.createUser(appName, deviceName);
    console.log(createdUser);
    console.log('*******************************************************************************\n');
    console.log('User has been created on the Hue Bridge. The following username can be used to\n' +
                'authenticate with the Bridge and provide full local access to the Hue Bridge.\n' +
                'YOU SHOULD TREAT THIS LIKE A PASSWORD\n');
    console.log(`Hue Bridge User: ${createdUser.username}`);
    console.log(`Hue Bridge User Client Key: ${createdUser.clientkey}`);
    console.log('*******************************************************************************\n');

    // Create a new API instance that is authenticated with the new user we created
    const authenticatedApi = await nodeHue.api.createLocal(host).connect(createdUser.username);

    // Do something with the authenticated user/api
    const bridgeConfig = await authenticatedApi.configuration.getConfiguration();
    console.log(`Connected to Hue Bridge: ${bridgeConfig.name} :: ${bridgeConfig.ipaddress}`);

    return createdUser.username;

  } catch(err) {
    console.log(err);
    if (err.getHueErrorType() === 101) {
      console.error('The Link button on the bridge was not pressed. Please press the Link button and try again.');
    } else {
      console.error(`Unexpected Error: ${err.message}`);
    }
  }
}

const findBridgeAndApi = async () => {
  if (!process.env.BRIDGE_IP) {
    const bridgeSearch = await nodeHue.discovery.nupnpSearch();

    if (!bridgeSearch.length || !bridgeSearch[0].ipaddress) {
      return 'Cannot find bridge';
    }

    const host = bridgeSearch[0].ipaddress;

    updateEnv('BRIDGE_IP', host);
  }

  if (!process.env.USERNAME) {
    const newUser = await createNewUser(host)
    updateEnv('USERNAME', newUser);
  }

  const api = await nodeHue.api.createLocal(process.env.BRIDGE_IP).connect(process.env.USERNAME);
  
  return api;
}

module.exports = { findBridgeAndApi };
