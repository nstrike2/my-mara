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

// A class built to ensure we ingest messages to our buffer in full, as opposed to in incomplete chunks
class MessageBuffer {
  constructor(delimiter) {
    this.delimiter = delimiter;
    this.buffer = "";
  }

  isFinished() {
    if (
      this.buffer.length === 0 ||
      this.buffer.indexOf(this.delimiter) === -1
    ) {
      return false;
    }
    return true;
  }

  push(data) {
    this.buffer += data;
  }

  getMessage() {
    const delimiterIndex = this.buffer.indexOf(this.delimiter);
    if (delimiterIndex !== -1) {
      const message = this.buffer.slice(0, delimiterIndex);
      this.buffer = this.buffer.replace(message + this.delimiter, "");
      return message;
    }
    return null;
  }

  handleData() {
    /**
     * Try to accumulate the buffer with messages
     *
     * If the server isnt sending delimiters for some reason
     * then nothing will ever come back for these requests
     */
    const message = this.getMessage();
    return message;
  }
}

class MyMaraNode {
  // socket = { port: port, host: host };
  // this socket passed in, which is the socket our node will run on, is added to our bootstrapping peers
  // knownObjects = { objectid: Hash of object, object: either block or transaction}
  constructor(socket, bootstrappingPeers, knownObjects) {
    this._nodeSocket = socket;
    this._bootstrappingPeers = bootstrappingPeers;
    this._knownObjects = knownObjects;
  }

  async validation(knownObjects, transaction) {
    const inputs = transaction.object.inputs;
    const outputs = transaction.object.outputs;
    let totalInputValue = 0;
    let totalOutputValue = 0;
    console.log(inputs);
    for (var ip = 0; ip < inputs.length; ip++) {
      const message = {
        type: "transaction",
        inputs: {
          outpoint: inputs[ip].outpoint,
          sig: null,
        },
        outputs: outputs,
      };

      const txid = inputs[ip].outpoint.txid;
      const signature = inputs[ip].sig;
      const index = inputs[ip].outpoint.txid;

      try {
        if (await knownObjects.exists(txid)) {
          const RetrievedObject = await knownObjects.get(txid);
          const publicKey = RetrievedObject.outputs[index].pubkey;
        } else {
          console.log("We do not have that object");
          const publicKey = null;
        }

        // look up the levels db and find the txid - it's outputs - get the pubkey.
        // look up the levels db and find the txid - it's outputs - get the pubkey.

        if (!validateSignature(message, signature, publicKey)) return false;
        if (!doesTxExist(txid)) return false;
        if (!checkIndex(txid, index)) return false;
        totalInputValue =
          totalInputValue +
          getValueForInput(inputs[ip].outpoint.txid, inputs[ip].outpoint.index);
      } catch (e) {
        console.log(e);
      }
    }

    for (var op = 0; op < transaction.outputs.length; op++) {
      var value = outputs[op].value;
      var pubkey = outputs[op].pubkey;

      if (!validatePubKey(pubkey)) return false;
      if (value < 0) return false;

      totalOutputValue = totalOutputValue + value;
    }

    if (totalOutputValue > totalInputValue) return false;

    return true;
  }

  validateSignature(message, signature, publicKey) {
    if (
      ed25519.Verify(
        Buffer.from(canonicalize(message), "utf8"),
        Buffer.from(signature, "hex"),
        Buffer.from(publicKey, "hex")
      )
    ) {
      return true;
    }

    return false;
  }

  async doesTxExist(knownObjects, txid) {
    // check if this txid exists in the db
    try {
      if (await knownObjects.exists(txid)) {
        return true;
      }
    } catch (e) {
      return false;
    }
    // will return true if there is tx
    // if no tx then it would return false
  }

  async checkIndex(knownObjects, txid, index) {
    // fetch the txid - check the number of outputs it has
    const RetrievedObject = await knownObjects.gets(txid);

    const noOfOutputs = RetrievedObject.outputs.length;
    if (index <= noOfOutputs) {
      return true;
    } else {
      console.log("Too less outputs... ");
      return false;
    }
  }

  validatePubKey(pubkey) {
    if (!pubkey.length == 64) return false;
    return true;
  }

  async getValueForInput(knownObjects, txid, index) {
    // find the txid

    const transaction = await knownObjects.get(txid);
    // get output from tx;
    const outputs = transaction.outputs;

    // iterate through the the tx output to find the op that matches with the index
    // get it's value and return
    const value = outputs[index].value;

    return value;
  }

  // fetch most recent version of bootstrapping peers database as a list
  async fetchPeersList(bootstrappingPeers) {
    let peersList = [];

    // iterate through most recent version of bootstrapping peers database
    for await (const [index, socket] of bootstrappingPeers.iterator()) {
      if (socket !== null && typeof socket !== "undefined") {
        // add to a list
        peersList.push((socket["host"] + ":" + socket["port"]).toString());
      }
    }

    // return list
    return peersList;
  }

  // fetch most recent version of objectsID's as a list
  async fetchObjectIDs(knownObjects) {
    let knownObjectIDS = [];

    // iterate through most recent version of knownObjects database
    for await (const [index, object] of knownObjects.iterator()) {
      knownObjectIDS.push(index);
    }

    // return list of known objectid's
    return knownObjectIDS;
  }

  // async fetchObject(knownObjects, objectid) {

  //   // iterate through most recent version of knownObjects database
  //   for await (const [index, object] of knownObjects.iterator()) {
  //     knownObjectIDS.push((object['objectid']).toString())
  //   }

  //   // return list of known objectid's
  //   return knownObjectIDS;
  // }

  // run client

  client(serverPort, serverHost) {
    // The port number and hostname of the server we're trying to connect to.
    const port = serverPort;
    const host = serverHost;
    // Create a new TCP client.
    const client = new Net.Socket();
    // Send a connection request to the server.
    client.connect({ port: port, host: host }, () => {
      // If there is no error, the server has accepted the request and created a new
      // socket dedicated to us.
      console.log("TCP connection established with the server.");

      const helloMsg = {
        type: "hello",
        version: "0.8.0",
        agent: "Marabu-Core Client 0.8",
      };

      const getPeers = {
        type: "getpeers",
      };

      // The client can now send data to the server by writing to its socket.
      // event type: data

      // send hello message
      client.write(canonicalize(helloMsg) + "\n");
      console.log("Client sent hello message");

      // send getPeers message
      client.write(canonicalize(getPeers) + "\n");
      console.log("Client sent getpeers message");
    });

    // The client can also receive data from the server by reading from its socket

    // Creating a buffer object ensuring we ingest messages to our buffer in full, as opposed to in incomplete chunks
    let received = new MessageBuffer("\n");

    client.on("data", async (chunk) => {
      received.push(chunk);

      // once our chunks make up the entire, complete message in our buffer and process it
      while (received.isFinished()) {
        const message = received.handleData();

        let array_chunk = message.toString().split("\n");

        console.log(`Received data from ${host} server: ${array_chunk}.`);

        for (let payload of array_chunk) {
          try {
            // check if message is valid JSON object
            if (typeof JSON.parse(payload) === "object") {
              // check if type hello and if version of type 0.8.x
              // if not, close the connection immediately!!
              let message = JSON.parse(payload.toString());

              if (
                message.type === "hello" &&
                semver.satisfies(message.version, "0.8.x")
              ) {
                console.log("Received hello message from server");
              } else if (message.type === "getpeers") {
                console.log("Received getpeers message from server");

                // fetch peers
                const peersList = await this.fetchPeersList(
                  this._bootstrappingPeers
                );

                const peers = {
                  type: "peers",
                  peers: peersList,
                };

                client.write(canonicalize(peers) + "\n");
                console.log(
                  "Sent these peers to server: " + JSON.stringify(peers)
                );
              } else if (message.type === "peers") {
                console.log("Got peers message from server");

                // add peers received to our database
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
                        const peers = await this._bootstrappingPeers
                          .iterator()
                          .all();
                        const index = peers.length;
                        await this._bootstrappingPeers.put(index, socket);
                      }
                    }
                  }
                }
              } else if (message.type === "ihaveobject") {
                const objectids = await this.fetchObjectIDs(this._knownObjects);

                if (objectids.includes(message.objectid)) {
                  console.log("Object already present in database");
                } else {
                  const getobject = {
                    type: "getobject",
                    objectid: message.objectid,
                  };
                  client.write(canonicalize(getobject) + "\n");
                }
              } else if (
                message.type === "transaction" ||
                message.type === "block"
              ) {
                console.log("Got a block or a transaction as a message");
                let encoder = new TextEncoder();
                let uint8array = encoder.encode(canonicalize(message));
                const messageHash = Buffer.from(sha256(uint8array)).toString(
                  "hex"
                );

                const objectids = await this.fetchObjectIDs(this._knownObjects);

                if (objectids.includes(messageHash)) {
                  console.log("Object already present in database");
                } else {
                  const objectsindb = await this._knownObjects.iterator().all();
                  const index = objectsindb.length;
                  await this._knownObjects.put(messageHash, message);

                  const IHaveObject = {
                    type: "ihaveobject",
                    objectid: messageHash,
                  };

                  client.write(canonicalize(IHaveObject) + "\n");
                }
              } else if (message.type === "getobject") {
                //check if objectid is in database
                console.log("Recieved getobject message from client");

                const objectids = await this.fetchObjectIDs(this._knownObjects);

                if (objectids.includes(message.objectid)) {
                  //const objectfromdb = await this.fetchObject(this._knownObjects, message.objectid)
                  const objectfromdb = await this._knownObjects.get(
                    message.objectid
                  );
                  console.log("Sent Object to client");
                  client.write(canonicalize(objectfromdb) + "\n");
                }
              } else {
                const error = {
                  type: "error",
                  error: "Unsupported message type received",
                };
                throw error;
                client.end();
              }
            } else {
              // throw error
              const error = {
                type: "error",
                error: "Message is not valid JSON",
              };
              client.end();
            }
          } catch (e) {
            const error = {
              type: "error",
              error: "Message is not valid JSON",
            };
            client.write(canonicalize(error));
            console.log(e);
            client.end();
          }
        }
      }
    });

    // Don't forget to catch error, for your own sake.
    client.on("error", (err) => {
      console.log(`Error: ${err}`);
    });

    // End connection, for your OWN SAKE.
    client.on("end", () => {
      console.log("Requested an end to the TCP connection");
    });
  }

  // run server
  server() {
    // The port on which the server is listening.
    const port = this._nodeSocket.port;
    // The host on which the server is running.
    const host = this._nodeSocket.host;
    // Use net.createServer() in your code. This is just for illustration purpose.
    // Create a new TCP server.
    const server = new Net.Server();
    // The server listens to a socket for a client to make a connection request.
    // Think of a socket as an end point.
    server.listen(port, () => {
      console.log(
        `Server listening for connection requests on socket ${host}:${port}.`
      );
    });

    // When a client requests a connection with the server, the server creates a new
    // socket dedicated to that client.
    server.on("connection", async (socket) => {
      let handshake = false;
      console.log("A new connection to the server has been established.");
      // Now that a TCP connection has been established, the server can send data to
      // the client by writing to its socket.
      const helloMsg = {
        type: "hello",
        version: "0.8.0",
        agent: "Marabu-Core Client 0.8",
      };

      const getPeers = {
        type: "getpeers",
      };

      // server sends hello message
      socket.write(canonicalize(helloMsg) + "\n");
      console.log("Server sent hello message");

      // server sends getpeers message
      socket.write(canonicalize(getPeers) + "\n");
      console.log("Server sent getpeers message");

      // Creating a buffer object ensuring we ingest messages to our buffer in full, as opposed to in incomplete chunks
      let received = new MessageBuffer("\n");

      // The server can also receive data from the client by reading from its socket.
      socket.on("data", async (chunk) => {
        received.push(chunk);

        // once our chunks make up the entire, complete message in our buffer and process it
        while (received.isFinished()) {
          const message = received.handleData();

          let array_chunk = message.toString().split("\n");

          console.log(`Received data from ${host} server: ${array_chunk}.`);

          for (let payload of array_chunk) {
            try {
              // check if message is valid JSON object
              if (typeof JSON.parse(payload) === "object") {
                // check if type hello and if version of type 0.8.x
                // if not, close the connection immediately!!
                let message = JSON.parse(payload.toString());
                if (
                  message.type === "hello" &&
                  semver.satisfies(message.version, "0.8.x") &&
                  handshake === false
                ) {
                  handshake = true;
                  console.log("Received hello message from client");
                } else if (message.type === "getpeers" && handshake === true) {
                  console.log("Received getpeers message from client");

                  // fetch peers
                  const peersList = await this.fetchPeersList(
                    this._bootstrappingPeers
                  );

                  const peers = {
                    type: "peers",
                    peers: peersList,
                  };

                  socket.write(canonicalize(peers) + "\n");
                  console.log(
                    "Sent these peers to client: " + JSON.stringify(peers)
                  );
                } else if (message.type === "peers" && handshake === true) {
                  console.log("Got peers message from client");

                  // add peers received to our database
                  for (let peer of message.peers) {
                    let [host, port] = peer.split(":");
                    const socket = { port: port, host: host };
                    const peers = await this._bootstrappingPeers
                      .iterator()
                      .all();
                    const index = peers.length;
                    await this._bootstrappingPeers.put(index, socket);
                  }
                } else if (
                  message.type === "ihaveobject" &&
                  handshake === true
                ) {
                  const objectids = await this.fetchObjectIDs(
                    this._knownObjects
                  );

                  if (objectids.includes(message.objectid)) {
                    console.log("Object already present in database");
                  } else {
                    const getobject = {
                      type: "getobject",
                      objectid: message.objectid,
                    };
                    socket.write(canonicalize(getobject) + "\n");
                  }
                } else if (
                  message.type === "transaction" ||
                  message.type === "block"
                  // have to add && handshake equals to true here
                ) {
                  console.log("Got a transaction or a block message");
                  let encoder = new TextEncoder();
                  let uint8array = encoder.encode(canonicalize(message));
                  const messageHash = Buffer.from(sha256(uint8array)).toString(
                    "hex"
                  );

                  const objectids = await this.fetchObjectIDs(
                    this._knownObjects
                  );

                  if (objectids.includes(messageHash)) {
                    console.log("Object already present in database");
                  } else {
                    if (this.validation(this._knownObjects, message)) {
                      await this._knownObjects.put(messageHash, message);

                      const IHaveObject = {
                        type: "ihaveobject",
                        objectid: messageHash,
                      };

                      socket.write(canonicalize(IHaveObject) + "\n");
                    } else {
                      console.log("message invalid");
                    }
                  }
                } else if (message.type === "getobject" && handshake === true) {
                  //check if objectid is in database
                  console.log("Recieved getobject message from client");

                  const objectids = await this.fetchObjectIDs(
                    this._knownObjects
                  );

                  if (objectids.includes(message.objectid)) {
                    //const objectfromdb = await this.fetchObject(this._knownObjects, message.objectid)
                    const objectfromdb = await this._knownObjects.get(
                      message.objectid
                    );
                    console.log("Sent Object to client");
                    socket.write(canonicalize(objectfromdb) + "\n");
                  }
                } else {
                  const error = {
                    type: "error",
                    error: "Unsupported message type received",
                  };
                  throw error;
                  socket.end();
                }
              } else {
                // throw error
                const error = {
                  type: "error",
                  error: "Message is not valid JSON",
                };
                socket.end();
              }
            } catch (e) {
              const error = {
                type: "error",
                error: "Message is not valid JSON",
              };
              socket.write(canonicalize(error));
              console.log(e);
              socket.end();
            }
          }
        }
      });

      // When the client requests to end the TCP connection with the server, the server
      // ends the connection.
      socket.on("end", () => {
        console.log("Closing connection with the client");
      });

      // Don't forget to catch error, for your own sake.
      socket.on("error", (err) => {
        console.log(`Error: ${err}`);
      });
    });
  }
}

// load the node
const loadNode = async () => {
  const GenesisBlock = {
    T: "00000002af000000000000000000000000000000000000000000000000000000",
    created: 1624219079,
    miner: "dionyziz",
    nonce: "0000000000000000000000000000000000000000000000000000002634878840",
    note: "The Economist 2021-06-20: Crypto-miners are probably to blame for the graphics-chip shortage",
    previd: null,
    txids: [],
    type: "block",
  };

  const GenesisBlockID =
    "00000000a420b7cefa2b7730243316921ed59ffe836e111ca3801f82a4f5360e";

  let encoder = new TextEncoder();
  let uint8array = encoder.encode(canonicalize(GenesisBlock));

  const genesishash = Buffer.from(sha256(uint8array)).toString("hex");
  //const genesishash = Buffer.from(sha256(canonicalize(GenesisBlock)), "hex");
  console.log("Neetish bhai");
  console.log(`${genesishash.toString()}`);

  //Have to convert from Uint8Array to string

  console.log(`${typeof genesishash}`);

  // Create a database for initial bootstrapping peers

  const bootstrappingPeers = new Level("bootstrappingPeers", {
    valueEncoding: "json",
  });

  const socket = { port: "18018", host: "104.207.149.243" };

  //to use for debugging
  //const socket = { port: "18018", host: "localhost" };

  // put initial peers from protocol into our database
  const initialPeers = [
    { port: 18018, host: "149.28.220.241" },
    { port: 18018, host: "149.28.204.235" },
    { port: 18018, host: "139.162.130.195" },
    //socket,
  ];

  // load up database with our initial peers
  for (const [index, socket] of initialPeers.entries()) {
    await bootstrappingPeers.put(index, socket);
  }

  //Create a database of knownObjects
  const knownObjects = new Level("knownObjects", {
    valueEncoding: "json",
  });

  await knownObjects.put(GenesisBlockID, GenesisBlock);

  // create our node
  const node = new MyMaraNode(socket, bootstrappingPeers, knownObjects);

  // run server from our node
  node.server();

  // connect to each of our node's trusted sockets from database
  for await (const [index, socket] of bootstrappingPeers.iterator()) {
    if (socket !== "" && socket !== null && typeof socket !== "undefined") {
      const port = String(socket.port);
      const host = String(socket.host);
      if (
        port !== "" &&
        !port.toLowerCase().includes("null") &&
        !port.toLowerCase().includes("undefined")
      ) {
        if (
          host !== "" &&
          !host.toLowerCase().includes("null") &&
          !host.toLowerCase().includes("undefined")
        ) {
          node.client(socket.port, socket.host);
        }
      }
    }
  }
};

// driver code
loadNode();
