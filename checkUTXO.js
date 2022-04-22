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

const checkUTXO = async (
  transaction,
  transactionhash,
  block,
  blockID,
  UTXOset,
  knownObjects
) => {
  listofUTXO = await UTXOset.get(block.previd);
  outpoints_to_remove_from_UTXO = [];
  outpoints_to_add_to_UTXO = [];
  if (listofUTXO !== null && typeof listofUTXO !== "undefined") {
    if (
      transaction.inputs !== null &&
      typeof transaction.inputs !== "undefined"
    ) {
      for (const input of transaction.inputs) {
        let outpoint = input.outpoint;
        if (listofUTXO.includes(outpoint)) {
          console.log("Transaction in UTXO");
          outpoints_to_remove_from_UTXO.push(oupoint);
        } else {
          await knownObjects.del(transactionhash);
          console.log("Transaction has invalid input");
          return false;
        }
      }
    }
    for (output = 0; output < transaction.outputs; output++) {
      const toadd = {
        txid: transaction.hash,
        index: output,
      };
      outpoints_to_add_to_UTXO.push(toadd);
    }
    for (const tx_to_remove of outpoints_to_remove_from_UTXO) {
      listofUTXO.remove(tx_to_remove);
    }
    for (const tx_to_add of outpoints_to_add_to_UTXO) {
      list.push(tx_to_add);
    }
    await UTXOset.put(blockID, listofUTXO);
  } else {
    console.log("empty UTXO");
  }
};

module.exports = {
  checkUTXO: checkUTXO,
};
