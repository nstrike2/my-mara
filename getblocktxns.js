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

const getblocktxns = async (
  block,
  blockID,
  objectids,
  client,
  knownObjects
) => {
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
  }
  // Functions
  this.checkIndex = async (
    type,
    txids,
    nonce,
    previd,
    created,
    T,
    miner,
    note,
    knownObjects
  ) => {
    var hex32Byte = /[0-9A-Fa-f]{64}/g;
    if (type != "block") return false;
    console.log("type");

    console.log(nonce);
    if (!hex32Byte.test(nonce)) {
      console.log("returning false 1");
      return false;
    }
    console.log("nonce");

    var hex32Byte = /[0-9A-Fa-f]{64}/g;
    console.log(nonce);
    if (!hex32Byte.test(nonce)) return false;
    console.log("nonce");

    var hex32Byte = /[0-9A-Fa-f]{64}/g;
    if (!hex32Byte.test(T)) return false;
    console.log("T");

    if (!Number.isFinite(created)) return false;
    console.log("isFinite");

    for (let i = 0; i < txids.length; i++) {
      var hex32Byte = /[0-9A-Fa-f]{64}/g;
      if (!hex32Byte.test(txids[i])) return false;
    }
    console.log("test");

    this.validateTx(txids, knownObjects);
    console.log("validateTx");

    return true;
  };

  this.validateTx = async function (txids, knownObjects) {
    for (let i = 0; i < txids.length; i++) {
      if (objectids.includes(txids[i])) {
        console.log("Transaction already present in database");
      } else {
        const getobject = {
          type: "getobject",
          objectid: txids[i],
        };
        client.write(canonicalize(getobject) + "\n");
      }
    }
  };

  // Testing
  if (
    !this.checkIndex(
      type,
      txids,
      nonce,
      previd,
      created,
      T,
      miner,
      note,
      knownObjects
    )
  ) {
    return false;
    console.log("Failed check index");
  }
};

module.exports = {
  getblocktxns: getblocktxns,
};
