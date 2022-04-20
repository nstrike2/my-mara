const { validation } = require("./validation.js");
const { blockvalidation } = require("./blockvalidation.js");
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

const IHaveObject = async (client, knownObjects, message, UTXOset) => {
  console.log("Got a block or a transaction as a message");
  let encoder = new TextEncoder();
  let uint8array = encoder.encode(canonicalize(message.object));
  const messageHash = Buffer.from(sha256(uint8array)).toString("hex");
  console.log("MSG HASH: " + messageHash);
  const objectids = await fetchObjectIDs(knownObjects);

  if (objectids.includes(messageHash)) {
    console.log("Object already present in database");
  } else {
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
      } else {
        const error = {
          type: "error",
          error: "Message is not valid object",
        };
        client.write(canonicalize(error) + "\n");
      }
    } else {
      // Validate block
      if (
        await blockvalidation(
          message.object,
          messageHash,
          objectids,
          client,
          knownObjects,
          UTXOset
        )
      ) {
        console.log("VALIDATED BLOCK !");
      } else {
        console.log("ERRANEOUS BLOCK");
      }
    }
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
