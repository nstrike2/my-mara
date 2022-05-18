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
const console = require("console");
const { validation } = require("./validation.js");

const checkTargetandPOW = (block, blockID, client) => {
  var type, txids, nonce, previd, created, T, miner, note;
  try {
    type = block.type;
    txids = block.txids;
    nonce = block.nonce;
    previd = block.previd;
    created = block.created;
    T = block.T;
    miner = block.miner;
    note = block.note;
    console.log("Checking that block has everything: works");
  } catch (e) {
    console.log("Malformed block...");
    const error = {
      type: "error",
      error: "Malformed block",
    };
    client.write(canonicalize(error) + "\n");
  }
  // Functions

  this.checkTarget = function (T) {
    if (T != "00000002af000000000000000000000000000000000000000000000000000000")
      return false;
    return true;
  };

  this.checkPOW = function (T, blockID) {
    if (parseInt(blockID, 16) >= parseInt(T, 16)) return false;
    console.log("Check POW");
    return true;
  };

  // Testing
  try {
    if (!this.checkTarget(T)) return false;
    console.log("Passed check Target");
    if (!this.checkPOW(T, blockID)) return false;
    console.log("Passed check POW");
    return true;
  } catch (e) {
    const error = {
      type: "error",
      error: "Failed to verify block due to incorrect target/pow",
    };
    client.write(canonicalize(error) + "\n");
  }
};

const alltxnsofblockcorrect = (txids, objectids) => {
  for (let i = 0; i < txids.length; i++) {
    if (objectids.includes(txids[i])) {
      return true;
    } else {
      return false;
    }
  }
};

module.exports = {
  checkTargetandPOW: checkTargetandPOW,
  alltxnsofblockcorrect: alltxnsofblockcorrect,
};
