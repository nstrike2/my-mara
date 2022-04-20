/*
    { 
        "type": "block", 
        "txids": [ "740bcfb434c89abe57bb2bc80290cd5495e87ebf8cd0dadb076bc50453590104" ], 
        "nonce": "a26d92800cf58e88a5ecf37156c031a4147c2128beeaf1cca2785c93242a4c8b", 
        "previd": "0024839ec9632d382486ba7aac7e0bda3b4bda1d4bd79be9ae78e7e1e813ddd8", 
        "created": 1622825642, 
        "T": "003a000000000000000000000000000000000000000000000000000000000000", 
        "miner": "dionyziz", 
        "note": "A sample block" 
    }
*/

/*
    class Block{
        constructor(type, txids, nonce, previd, created, T){
            this._type = type;
            this._txids = txids;
            this._nonce = nonce;
            this._created = created;
            this._T = T;
        }
    }
*/

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

var blockvalidation = async (
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
  } catch (e) {
    console.log("Malformed block...");
  }
  // Functions
  this.checkIndex = function (
    type,
    txids,
    nonce,
    previd,
    created,
    T,
    miner,
    note,
    knownObjects
  ) {
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

    if (!this.validateTx(txids, knownObjects)) return false;
    console.log("validateTx");

    return true;
  };

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

  this.checkTxInDB = function (txids, objectids, client) {
    try {
      for (let i = 0; i < txids.length; i++) {
        if (!objectids.includes(txids[i])) {
          const getobject = {
            type: "getobject",
            objectid: txids[i],
          };
          console.log("Getting obj !...");
          client.write(canonicalize(getobject) + "\n");
        }
      }
    } catch (e) {
      const error = {
        type: "error",
        error: "Something is wrong with the message",
      };
      client.write(canonicalize(error));
      console.log(e);
      client.end();
    }
  };

  this.validateTx = async function (txids, knownObjects) {
    for (let i = 0; i < txids.length; i++) {
      var message = await knownObjects.get(txids[i]);
      var transaction = message.object;
      console.log(await validation(knownObjects, transaction));
      if (!(await validation(knownObjects, transaction))) return false;
      return true;
    }
  };

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
    try {
      for (let i = 0; i <= txids.length; i++) {
        var message = await knownObjects.get(txids[i]);
        console.log(message);
        console.log("message: " + message);
        var transaction = message;

        var inputs = null;
        try {
          inputs = transaction.outpoint.inputs;
        } catch (e) {
          console.log("Coinbase Tx...");
        }
        console.log("INPUTSSS: " + inputs);

        var coinbaseTxId = null;
        if (inputs == null) {
          if (i == 0) {
            coinbaseTxId = txids[0];
            console.log("TX: " + transaction);
            coinbaseTx = transaction;
          }
          if (i != 0) return false;
        } else {
          for (let i = 0; i < inputs.length; i++) {
            if (inputs[i].outpoint.txid == coinbaseTxId) return false;
          }
        }
      }
    } catch (e) {}
    console.log(coinbaseTx);
    if (!this.validateCoinbase(coinbaseTx)) return false;
    if (!this.checkPoCCoinbase(block, coinbaseTx, knownObjects)) return false;
    return true;
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
  )
    return false;

  var coinbaseTx = null;
  try {
    console.log("Pased checkIndex");
    if (!this.checkTarget(T)) return false;
    console.log("Pased checkTarget");
    if (!this.checkPOW(T, blockID)) return false;
    console.log("Pased checkPOW");
    this.checkTxInDB(txids, objectids, client);
    console.log("Pased checkTxInDB");
    if (!this.checkCoinbaseTx(block, txids, knownObjects)) return false;
    console.log("Pased checkCoinbaseTx");
  } catch (e) {}

  return true;
};

module.exports = {
  blockvalidation: blockvalidation,
};

// {"type" :"object", "object": {"type": "transaction","height": 0,"outputs": [{"pubkey": "8dbcd2401c89c04d6e53c81c90aa0b551cc8fc47c0469217c8f5cfbae1e911f9","value": 50000000000}]}}

// {"object": {"nonce": "c5ee71be4ca85b160d352923a84f86f44b7fc4fe60002214bc1236ceedc5c615", "T": "00000002af000000000000000000000000000000000000000000000000000000", "created": 1649827795114, "miner": "svatsan", "note": "First block. Yayy, I have 50 bu now!!", "previd": "00000000a420b7cefa2b7730243316921ed59ffe836e111ca3801f82a4f5360e", "txids": ["1bb37b637d07100cd26fc063dfd4c39a7931cc88dae3417871219715a5e374af"],"type": "block"}, "type":"object"}
