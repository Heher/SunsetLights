import nodeHue from 'node-hue-api';
import dotenv from 'dotenv';
import { v3 } from 'node-hue-api';
import dotenvParseVariables from 'dotenv-parse-variables';
import fs from 'fs';
import os from 'os';
import { Api } from 'node-hue-api/dist/esm/api/Api';

const env = dotenv.config({ path: '/home/pi/Hue/SunsetLights/.env' });

function updateEnv(keyName: string, value: string): void {
  if (!env?.parsed) {
    throw new Error(`No .env file found in ${process.cwd()}`);
  }

  const variables = dotenvParseVariables(env.parsed);

  variables[keyName] = value;

  let variableArray: string[] = [];

  Object.keys(variables).forEach((key) => {
    variableArray.push(`${key}=${variables[key]}`);
  });

  fs.writeFileSync('/home/pi/Hue/SunsetLights/.env', variableArray.join(os.EOL));
}

async function createNewUser(host: string): Promise<string> {
  const appName = 'node-hue';
  const deviceName = 'home-server';

  const unauthenticatedApi = await v3.api.createLocal(host).connect();

  try {
    const createdUser = await unauthenticatedApi.users.createUser(appName, deviceName);
    console.log(createdUser);
    console.log('*******************************************************************************\n');
    console.log(
      'User has been created on the Hue Bridge. The following username can be used to\n' +
        'authenticate with the Bridge and provide full local access to the Hue Bridge.\n' +
        'YOU SHOULD TREAT THIS LIKE A PASSWORD\n'
    );
    console.log(`Hue Bridge User: ${createdUser.username}`);
    console.log(`Hue Bridge User Client Key: ${createdUser.clientkey}`);
    console.log('*******************************************************************************\n');

    // Create a new API instance that is authenticated with the new user we created
    const authenticatedApi = await nodeHue.api.createLocal(host).connect(createdUser.username);

    // Do something with the authenticated user/api
    const bridgeConfig = await authenticatedApi.configuration.getConfiguration();
    console.log(`Connected to Hue Bridge: ${bridgeConfig.name} :: ${bridgeConfig.ipaddress}`);

    return createdUser.username;
  } catch (err) {
    console.log(err);
    if (err.getHueErrorType() === 101) {
      console.error('The Link button on the bridge was not pressed. Please press the Link button and try again.');
    } else {
      console.error(`Unexpected Error: ${err.message}`);
    }
  }
}

export async function findBridgeAndApi(): Promise<Api> {
  let host = process?.env?.BRIDGE_IP;
  let username = process?.env?.USERNAME;

  if (!host) {
    const bridgeSearch = await nodeHue.discovery.nupnpSearch();

    if (!bridgeSearch.length || !bridgeSearch[0].ipaddress) {
      throw new Error('Cannot find bridge');
    }

    host = bridgeSearch[0].ipaddress;

    updateEnv('BRIDGE_IP', host);
  }

  if (!username) {
    const username = await createNewUser(host);
    updateEnv('USERNAME', username);
  }

  const api = await nodeHue.api.createLocal(host).connect(username);

  return api;
}
