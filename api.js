const v3 = require('node-hue-api').v3;
const dotenv = require('dotenv');
dotenv.config();

const findBridgeAndApi = async () => {
  const bridgeSearch = await v3.discovery.nupnpSearch();

  const host = bridgeSearch[0].ipaddress;
  const api = await v3.api.createLocal(host).connect(process.env.USERNAME);

  return api;
}

module.exports = { findBridgeAndApi };
