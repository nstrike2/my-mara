const { validation } = require("./validation.js");
const { coinbasecheck } = require("./CoinbaseValidation.js");
const { checkUTXO } = require("./checkUTXO.js");
const {
  checkTargetandPOW,
  alltxnsofblockcorrect,
} = require("./checkTargetandPOW.js");
const { getblocktxns } = require("./getblocktxns.js");
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

const validateparentblock = async (
  message,
  messageHash,
  UTXOset,
  knownObjects,
  client,
  temporary_blocks_db,
  blocksandtxids
) => {
  const objectids = await fetchObjectIDs(knownObjects);
  if (objectids.includes(message.previd)) {
    console.log("Parent block is valid");
    for await (const [index, block] of temporary_blocks_db.iterator()) {
      //Validate block
      if (checkTargetandPOW(block, messageHash, client)) {
        await blocksandtxids.put(messageHash, block);
        getblocktxns(
          block.object,
          messageHash,
          objectids,
          client,
          knownObjects
        );
      } else {
        const error = {
          type: "error",
          error: "Incorrect Target or POW",
        };
        client.write(canonicalize(error) + "\n");
      }
      await temporary_blocks_db.del(index);
    }
  }

  if (message.previd === null) {
    //it is genesis block
    //validate(genesis_block);
    for await (const [index, block] of temporary_blocks_db.iterator()) {
      //Validate block
      if (checkTargetandPOW(block, messageHash, client)) {
        await blocksandtxids.put(messageHash, block);
        getblocktxns(
          block.object,
          messageHash,
          objectids,
          client,
          knownObjects
        );
      } else {
        const error = {
          type: "error",
          error: "Incorrect Target or POW",
        };
        client.write(canonicalize(error) + "\n");
      }
      await temporary_blocks_db.del(index);
    }
  }

  if (!objectids.includes(message.previd)) {
    const getobject = {
      type: "getobject",
      objectid: message.previd,
    };
    client.write(canonicalize(getobject) + "\n");
  }
};

module.exports = {
  validateparentblock: validateparentblock,
};
