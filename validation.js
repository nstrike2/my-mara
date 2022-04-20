const {
  fetchObjectIDs,
  fetchPeersList,
  // PrefillPeers,
  // PrefillObjects,
} = require("./fetchfromdb.js");

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

var validation = async (knownObjects, transaction) => {
  this.validateSignature = async function (message, signature, publicKey) {
    if (
      await ed25519.Verify(
        Buffer.from(canonicalize(message), "utf8"),
        Buffer.from(signature, "hex"),
        Buffer.from(publicKey, "hex")
      )
    ) {
      return true;
    }
    console.log("Invalid Signature");
    return false;
  };

  this.checkIndex = async function (RetrievedObject, txid, index) {
    // fetch the txid - check the number of outputs it has

    const noOfOutputs = RetrievedObject.outputs.length;
    if (index <= noOfOutputs) {
      return true;
    } else {
      console.log("Too less outputs... ");
      return false;
    }
  };

  this.validatePubKey = function (pubkey) {
    if (!pubkey.length == 64) {
      console.log("Wrong pubkey size");
      return false;
    }
    return true;
  };

  this.getValueForInput = function (RetrievedObject, index) {
    const outputs = RetrievedObject.outputs;
    const value = outputs[index].value;

    return value;
  };

  var inputs = null;
  try {
    inputs = transaction.inputs;
  } catch (e) {
    // need to add more checks
    return true;
  }
  console.log("In validation");
  if (inputs == null) return true;
  const outputs = transaction.outputs;
  const objectids = await fetchObjectIDs(knownObjects);
  let totalInputValue = 0;
  let totalOutputValue = 0;

  for (var ip = 0; ip < inputs.length; ip++) {
    const txid = inputs[ip].outpoint.txid;
    const signature = inputs[ip].sig;
    const index = inputs[ip].outpoint.index;
    // parseInt((inputs[ip].outpoint.index).toString(), 10);
    console.log("IND: " + index);
    if (index < 0) return false;
    var publicKey = null;
    var RetrievedObject = null;
    var RetrievedObjectOutputs = null;

    const message = {
      type: "transaction",
      inputs: inputs.map((input) => ({
        outpoint: input.outpoint,
        sig: null,
      })),
      outputs: outputs,
    };

    if (objectids.includes(txid)) {
      RetrievedObject = await knownObjects.get(txid);
      RetrievedObjectOutputs = RetrievedObject.outputs;

      publicKey = RetrievedObjectOutputs[index].pubkey;
    } else {
      console.log("We do not have that object");
      const publicKey = null;
      return false;
    }

    if (!(await this.validateSignature(message, signature, publicKey)))
      return false;
    console.log("Sig verified");
    if (!(await this.checkIndex(RetrievedObject, txid, index))) return false;
    console.log("Ind verified");
    totalInputValue =
      totalInputValue + this.getValueForInput(RetrievedObject, index);
  }

  for (var op = 0; op < outputs.length; op++) {
    var value = outputs[op].value;
    var pubkey = outputs[op].pubkey;

    if (!this.validatePubKey(pubkey)) return false;
    console.log("Pub Key verified");
    if (value < 0) return false;
    console.log("Value verified");

    totalOutputValue = totalOutputValue + value;
  }

  if (totalOutputValue > totalInputValue) {
    console.log("Law of conservation of $ aint workin...");
    return false;
  }

  console.log("VERIFIED!");
  return true;
};

module.exports = {
  validation: validation,
};
