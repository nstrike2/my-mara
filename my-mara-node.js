const { validation } = require("./validation.js");
const { MessageBuffer } = require("./messagebuffer.js");
const { checkUTXO } = require("./checkUTXO.js");
const {
  SendHelloMsg,
  SendGetPeers,
  SendPeers,
  AddPeerstodb,
  SendGetObject,
  IHaveObject,
  SendObject,
} = require("./responsestodata.js");
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

class MyMaraNode {
  // socket = { port: port, host: host };
  // this socket passed in, which is the socket our node will run on, is added to our bootstrapping peers
  // knownObjects = { objectid: Hash of object, object: either block or transaction}
  constructor(
    socket,
    bootstrappingPeers,
    knownObjects,
    UTXOset,
    blocksandtxids
  ) {
    this._nodeSocket = socket;
    this._bootstrappingPeers = bootstrappingPeers;
    this._knownObjects = knownObjects;
    this._UTXOset = UTXOset;
    this._blocksandtxids = blocksandtxids;
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
      // The client can now send data to the server by writing to its socket.
      // event type: data
      // send hello message
      SendHelloMsg(client);
      // send getPeers message
      SendGetPeers(client);
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
                // fetch and send peers
                SendPeers(client, this._bootstrappingPeers);
              } else if (message.type === "peers") {
                // add peers received to our database
                AddPeerstodb(message, this._bootstrappingPeers);
              } else if (message.type === "ihaveobject") {
                SendGetObject(client, this._knownObjects, message);
              } else if (message.type === "object") {
                //if it is a block
                //if it is a transaction
                IHaveObject(
                  client,
                  this._knownObjects,
                  message,
                  this._UTXOset,
                  this._blocksandtxids
                );
              } else if (message.type === "getobject") {
                SendObject(client, this._knownObjects, message);
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
              error: "Something is wrong with the message",
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
      SendHelloMsg(socket);
      // send getPeers message
      SendGetPeers(socket);

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
                  SendPeers(socket, this._bootstrappingPeers);
                } else if (message.type === "peers" && handshake === true) {
                  AddPeerstodb(message, this._bootstrappingPeers);
                } else if (
                  message.type === "ihaveobject" &&
                  handshake === true
                ) {
                  SendGetObject(socket, this._knownObjects, message);
                } else if (message.type === "object") {
                  IHaveObject(
                    socket,
                    this._knownObjects,
                    message,
                    this._UTXOset,
                    this._blocksandtxids
                  );
                } else if (message.type === "getobject" && handshake === true) {
                  SendObject(socket, this._knownObjects, message);
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
                error: "Something is wrong with the message",
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
  // Create Peers List
  // Add Genesis Block
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
  let encoder = new TextEncoder();
  let uint8array = encoder.encode(canonicalize(GenesisBlock));
  const genesishash = Buffer.from(sha256(uint8array)).toString("hex");

  //Create a database of knownObjects
  const knownObjects = new Level("knownObjects", {
    valueEncoding: "json",
  });

  //Create a database of blocks and txids
  const blocksandtxids = new Level("blocksandtxids", {
    valueEncoding: "json",
  });

  await knownObjects.put(genesishash, GenesisBlock);
  const UTXOset = new Level("UTXOset", {
    valueEncoding: "json",
  });

  const UTXOafterGenesis = [
    {
      txid: null,
      index: null,
    },
  ];

  await UTXOset.put(genesishash, UTXOafterGenesis);
  // create our node
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
  const node = new MyMaraNode(
    socket,
    bootstrappingPeers,
    knownObjects,
    UTXOset,
    blocksandtxids
  );
  // run server from our node
  node.server();
  //connect to each of our node's trusted sockets from database
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
