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

const coinbasecheck = async (block, knownObjects) => {
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
  this.validateCoinbase = function (coinbaseTx) {
    console.log("coinbaseTx: " + coinbaseTx);
    if (coinbaseTx.outputs.length > 1) return false;
    try {
      var hex32Byte = /[0-9A-Fa-f]{64}/g;
      if (!Number.isFinite(coinbaseTx.height)) return false;
      if (!hex32Byte.test(coinbaseTx.outputs[0].pubkey)) return false;
    } catch (e) {}
  };

  this.getValueForInput = function (retrievedObject, index) {
    const outputs = retrievedObject.outputs;
    const value = outputs[index].value;

    return value;
  };

  this.checkPoCCoinbase = function (block, coinbaseTx, knownObjects) {
    var txFee = this.calculateTxFee(block, knownObjects);
    const blockReward = 50 * 10e12;
    if (coinbaseTx.outputs.value > txFee + blockReward) return false;
  };

  this.calculateTxFee = async function (block, knownObjects) {
    var txids = block.txids;
    var totalInputValue = 0;
    var totalOutputValue = 0;
    for (let i = 0; i < txids.length; i++) {
      var retrievedObject = await knownObjects.get(txids[i]);
      for (let j = 0; j < retrievedObject.inputs.length; j++) {
        totalInputValue =
          totalInputValue +
          this.getValueForInput(
            retrievedObject,
            retrievedObject.inputs[i].outpoint.index
          );
      }
      for (let k = 0; k < retrievedObject.outputs.length; k++) {
        var value = outputs[k].value;
        totalOutputValue = totalOutputValue + value;
      }
    }
    return totalInputValue - totalOutputValue;
  };

  this.checkCoinbaseTx = async function (block, txids, knownObjects) {
    let shouldbeCB = block.txids[0];
    coinbaseTx = await knownObjects.get(shouldbeCB);
    console.log("This is supposed CB tx");
    console.log(`${coinbaseTx}`);
    console.log(`${coinbaseTx.height}`);
    console.log(`${typeof coinbaseTx.height}`);
    try {
      if (
        coinbaseTx.height !== null &&
        typeof coinbaseTx.height !== "undefined"
      ) {
        if (!this.validateCoinbase(coinbaseTx)) return false;
        if (!this.checkPoCCoinbase(block, coinbaseTx, knownObjects))
          return false;
        return true;
      } else {
        console.log("No coinbase TX");
        return true;
      }
    } catch (e) {
      console.log("Block does not have any transactions");
      return true;
    }

    //if input is not existing it is coinbase otherwise no coinbase exists
  };

  // Testing
  var coinbaseTx = null;
  try {
    if (!this.checkCoinbaseTx(block, txids, knownObjects)) return false;
    console.log("Passed checkCoinbaseTx");
    // if (!this.checkUTXO(block, UTXOset, blockID, knownObjects)) return false;
    // console.log("Pased UTXO");
  } catch (e) {}

  // return true;
};

module.exports = {
  coinbasecheck: coinbasecheck,
};

// {"type" :"object", "object": {"type": "transaction","height": 0,"outputs": [{"pubkey": "8dbcd2401c89c04d6e53c81c90aa0b551cc8fc47c0469217c8f5cfbae1e911f9","value": 50000000000}]}}

// {"object": {"nonce": "c5ee71be4ca85b160d352923a84f86f44b7fc4fe60002214bc1236ceedc5c615", "T": "00000002af000000000000000000000000000000000000000000000000000000", "created": 1649827795114, "miner": "svatsan", "note": "First block. Yayy, I have 50 bu now!!", "previd": "00000000a420b7cefa2b7730243316921ed59ffe836e111ca3801f82a4f5360e", "txids": ["1bb37b637d07100cd26fc063dfd4c39a7931cc88dae3417871219715a5e374af"],"type": "block"}, "type":"object"}
