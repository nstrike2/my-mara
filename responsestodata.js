const { validation } = require("./validation.js");
const { coinbasecheck } = require("./CoinbaseValidation.js");
const { checkUTXO } = require("./checkUTXO.js");
const { validateparentblock } = require("./checkchain.js");

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

const SendHelloMsg = (client) => {
  const helloMsg = {
    type: "hello",
    version: "0.8.0",
    agent: "Marabu-Core Client 0.8",
  };
  client.write(canonicalize(helloMsg) + "\n");
  console.log("Sent hello message");
};

const SendGetPeers = (client) => {
  const getPeers = {
    type: "getpeers",
  };
  client.write(canonicalize(getPeers) + "\n");
  console.log("Sent get peers message");
};

const SendPeers = async (client, bootstrappingPeers) => {
  const peersList = await fetchPeersList(bootstrappingPeers);

  const peers = {
    type: "peers",
    peers: peersList,
  };

  client.write(canonicalize(peers) + "\n");
  console.log("Sent these peers: " + JSON.stringify(peers));
};

const AddPeerstodb = async (message, bootstrappingPeers) => {
  console.log("Got peers message");
  for (let peer of message.peers) {
    if (peer !== null && typeof peer !== "undefined") {
      let [host, port] = peer.split(":");
      if (
        !host.toLowerCase().includes("null") &&
        !host.toLowerCase().includes("undefined")
      ) {
        if (
          !port.toLowerCase().includes("null") &&
          !port.toLowerCase().includes("undefined")
        ) {
          const socket = { port: port, host: host };
          const peers = await bootstrappingPeers.iterator().all();
          const index = peers.length;
          await bootstrappingPeers.put(index, socket);
        }
      }
    }
  }
};

const SendGetObject = async (client, knownObjects, message) => {
  const objectids = await fetchObjectIDs(knownObjects);

  if (objectids.includes(message.objectid)) {
    console.log("Object already present in database");
  } else {
    const getobject = {
      type: "getobject",
      objectid: message.objectid,
    };
    client.write(canonicalize(getobject) + "\n");
  }
};

const IHaveObject = async (
  client,
  knownObjects,
  message,
  UTXOset,
  blocksandtxids,
  temporary_blocks_db
) => {
  console.log("Got a block or a transaction as a message");
  let encoder = new TextEncoder();
  let uint8array = encoder.encode(canonicalize(message.object));
  const messageHash = Buffer.from(sha256(uint8array)).toString("hex");
  console.log("MSG HASH: " + messageHash);
  let objectids = await fetchObjectIDs(knownObjects);

  if (objectids.includes(messageHash)) {
    console.log("Object already present in database");
  }

  if (message.object.type === "transaction") {
    // Validate transaction
    if (await validation(knownObjects, message.object)) {
      console.log("TX VALIDATED!");
      await knownObjects.put(messageHash, message.object);
      const IHaveObject = {
        type: "ihaveobject",
        objectid: messageHash,
      };
      client.write(canonicalize(IHaveObject) + "\n");
      //check if block is complete
      objectids = await fetchObjectIDs(knownObjects);
      for await (const [hash, block] of blocksandtxids.iterator()) {
        console.log("Testing");
        console.log(`${block.txids}`);
        console.log(`${hash}`);
        if (
          block.txids !== "" &&
          block.txids !== null &&
          typeof block.txids !== "undefined"
        ) {
          if (alltxnsofblockcorrect(block.txids, objectids)) {
            await knownObjects.put(hash, block);
            if (coinbasecheck(block, knownObjects)) {
              if (
                checkUTXO(
                  message.object,
                  messageHash,
                  block,
                  hash,
                  UTXOset,
                  knownObjects
                )
              ) {
                const IHaveObject = {
                  type: "ihaveobject",
                  objectid: hash,
                };
                client.write(canonicalize(IHaveObject) + "\n");
                console.log("UTXO works");
              } else {
                const error = {
                  type: "error",
                  error: "Invalid UTXO",
                };
                await knownObjects.del(hash);
                client.write(canonicalize(error) + "\n");
              }
            } else {
              const error = {
                type: "error",
                error: "Invalid coinbase",
              };
              await knownObjects.del(hash);
              client.write(canonicalize(error) + "\n");
            }

            //check for coinbase transaction
          }
        }
      }
    } else {
      const error = {
        type: "error",
        error: "Failed to verify transaction",
      };
      client.write(canonicalize(error) + "\n");
    }
  }

  if (message.object.type === "block") {
    const temporary_blocks = await temporary_blocks_db.iterator().all();
    const index = temporary_blocks.length;
    await temporary_blocks_db.put(messageHash, message.object);
    validateparentblock(
      message.object,
      messageHash,
      UTXOset,
      knownObjects,
      client,
      temporary_blocks_db,
      blocksandtxids
    );
  }
};

const SendObject = async (client, knownObjects, message) => {
  //check if objectid is in database
  console.log("Recieved getobject message");

  const objectids = await fetchObjectIDs(knownObjects);
  if (objectids.includes(message.objectid)) {
    //const objectfromdb = await this.fetchObject(this._knownObjects, message.objectid)
    const objectfromdb = await knownObjects.get(message.objectid);
    const objectToSend = {
      object: objectfromdb,
      type: "object",
    };
    console.log("Sent object");
    client.write(canonicalize(objectToSend) + "\n");
  }
};

module.exports = {
  SendHelloMsg: SendHelloMsg,
  SendGetPeers: SendGetPeers,
  SendPeers: SendPeers,
  AddPeerstodb: AddPeerstodb,
  SendGetObject: SendGetObject,
  IHaveObject: IHaveObject,
  SendObject: SendObject,
};
