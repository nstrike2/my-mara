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
const { fetchObjectIDs, fetchPeersList } = require("./fetchfromdb.js");

var responsetogetpeers = async (socket, bootstrappingPeers) => {
  console.log("Received getpeers message from client");

  // fetch peers
  const peersList = await fetchPeersList(bootstrappingPeers);

  const peers = {
    type: "peers",
    peers: peersList,
  };

  socket.write(canonicalize(peers) + "\n");
  console.log("Sent these peers to client: " + JSON.stringify(peers));
};

module.exports = {
  responsetogetpeers: responsetogetpeers,
};
