const { validation } = require("./validation.js");
const { MessageBuffer } = require("./messagebuffer.js");
// Include Nodejs' net module.
const Net = require("net");
// Use JSON Canonicalize package
const canonicalize = require("canonicalize");
//Using semver to check the node version
const semver = require("semver");
//Using Level to store the trusted peers and the objects and object ID's
// Object ID is hash of the canonicalized object
const { Level } = require("level");
// Using fast-sha256 to hash the objects
const sha256 = require("fast-sha256");
const ed25519 = require("ed25519");

// fetching list of trusted peers
var fetchPeersList = async (bootstrappingPeers) => {
  let peersList = [];

  // iterate through most recent version of bootstrapping peers database
  for await (const [index, socket] of bootstrappingPeers.iterator()) {
    if (socket !== null && typeof socket !== "undefined") {
      // add to a list
      peersList.push((socket["host"] + ":" + socket["port"]).toString());
    }
  }

  // return list
  return peersList;
};

// fetching ID's of known objects
var fetchObjectIDs = async (knownObjects) => {
  let knownObjectIDS = [];

  // iterate through most recent version of knownObjects database
  for await (const [index, object] of knownObjects.iterator()) {
    knownObjectIDS.push(index);
  }

  // return list of known objectid's
  return knownObjectIDS;
};

// const PrefillObjects = async () => {

// };

// const PrefillPeers = async () => {
//   return bootstrappingPeers;
// };

module.exports = {
  fetchObjectIDs: fetchObjectIDs,
  fetchPeersList: fetchPeersList,
  // PrefillObjects: PrefillObjects,
  // PrefillPeers: PrefillPeers,
};
