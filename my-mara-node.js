const { validation } = require("./validation.js");
const { MessageBuffer } = require("./messagebuffer.js");
const { responsetogetpeers } = require("./responsestodata.js");
const { fetchObjectIDs, fetchPeersList } = require("./fetchfromdb.js");

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

class MyMaraNode {
  // socket = { port: port, host: host };
  // this socket passed in, which is the socket our node will run on, is added to our bootstrapping peers
  // knownObjects = { objectid: Hash of object, object: either block or transaction}
  constructor(socket, bootstrappingPeers, knownObjects) {
    this._nodeSocket = socket;
    this._bootstrappingPeers = bootstrappingPeers;
    this._knownObjects = knownObjects;
  }

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
                const objectids = await fetchObjectIDs(this._knownObjects);

                if (objectids.includes(message.objectid)) {
                  console.log("Object already present in database");
                } else {
                  const getobject = {
                    type: "getobject",
                    objectid: message.objectid,
                  };
                  client.write(canonicalize(getobject) + "\n");
                }
              } else if (message.type === "object") {
                console.log("Got a block or a transaction as a message");
                let encoder = new TextEncoder();
                let uint8array = encoder.encode(canonicalize(message.object));
                const messageHash = Buffer.from(sha256(uint8array)).toString(
                  "hex"
                );
                console.log("MSG HASH: " + messageHash);
                const objectids = await fetchObjectIDs(this._knownObjects);

                if (objectids.includes(messageHash)) {
                  console.log("Object already present in database");
                } else {
                  const objectsindb = await this._knownObjects.iterator().all();
                  const index = objectsindb.length;
                  await this._knownObjects.put(messageHash, message.object);

                  const IHaveObject = {
                    type: "ihaveobject",
                    objectid: messageHash,
                  };

                  client.write(canonicalize(IHaveObject) + "\n");
                }
              } else if (message.type === "getobject") {
                //check if objectid is in database
                console.log("Recieved getobject message from client");

                const objectids = await fetchObjectIDs(this._knownObjects);

                if (objectids.includes(message.objectid)) {
                  //const objectfromdb = await this.fetchObject(this._knownObjects, message.objectid)
                  const objectfromdb = await this._knownObjects.get(
                    message.objectid
                  );
                  const objectToSend = {
                    object: objectfromdb,
                    type: "object",
                  };
                  console.log("Sent Object to client");
                  client.write(canonicalize(objectToSend) + "\n");
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
                  semver.satisfies(message.version, "0.8.x")
                ) {
                  handshake = true;
                  console.log("Received hello message from client");
                } else if (message.type === "getpeers" && handshake === true) {
                  responsetogetpeers(socket, this._bootstrappingPeers);
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
                  const objectids = await fetchObjectIDs(this._knownObjects);

                  if (objectids.includes(message.objectid)) {
                    console.log("Object already present in database");
                  } else {
                    const getobject = {
                      type: "getobject",
                      objectid: message.objectid,
                    };
                    socket.write(canonicalize(getobject) + "\n");
                  }
                } else if (message.type === "object") {
                  console.log("Got a transaction or a block message");
                  let encoder = new TextEncoder();
                  let uint8array = encoder.encode(canonicalize(message.object));
                  const messageHash = Buffer.from(sha256(uint8array)).toString(
                    "hex"
                  );

                  const objectids = await fetchObjectIDs(this._knownObjects);

                  if (objectids.includes(messageHash)) {
                    console.log("Object already present in database");
                  } else {
                    console.log(`${typeof validation}`);
                    if (await validation(this._knownObjects, message.object)) {
                      await this._knownObjects.put(messageHash, message.object);

                      const IHaveObject = {
                        type: "ihaveobject",
                        objectid: messageHash,
                      };

                      socket.write(canonicalize(IHaveObject) + "\n");
                    } else {
                      const error = {
                        type: "error",
                        error: "Message is not valid object",
                      };
                      socket.write(canonicalize(error) + "\n");
                    }
                  }
                } else if (message.type === "getobject" && handshake === true) {
                  //check if objectid is in database
                  console.log("Recieved getobject message from client");

                  const objectids = await fetchObjectIDs(this._knownObjects);

                  if (objectids.includes(message.objectid)) {
                    //const objectfromdb = await this.fetchObject(this._knownObjects, message.objectid)
                    const objectfromdb = await this._knownObjects.get(
                      message.objectid
                    );
                    const objectToSend = {
                      object: objectfromdb,
                      type: "object",
                    };
                    console.log("Sent Object to client");
                    socket.write(canonicalize(objectToSend) + "\n");
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

  //const socket = { port: "18018", host: "104.207.149.243" };

  //to use for debugging
  const socket = { port: "18018", host: "localhost" };

  // put initial peers from protocol into our database
  const initialPeers = [
    //{ port: 18018, host: "149.28.220.241" },
    //{ port: 18018, host: "149.28.204.235" },
    //{ port: 18018, host: "139.162.130.195" },
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
  // for await (const [index, socket] of bootstrappingPeers.iterator()) {
  //   if (socket !== "" && socket !== null && typeof socket !== "undefined") {
  //     const port = String(socket.port);
  //     const host = String(socket.host);
  //     if (
  //       port !== "" &&
  //       !port.toLowerCase().includes("null") &&
  //       !port.toLowerCase().includes("undefined")
  //     ) {
  //       if (
  //         host !== "" &&
  //         !host.toLowerCase().includes("null") &&
  //         !host.toLowerCase().includes("undefined")
  //       ) {
  //         node.client(socket.port, socket.host);
  //       }
  //     }
  //   }
  // }
};

// driver code
loadNode();
