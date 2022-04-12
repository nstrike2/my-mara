// Include Nodejs' net module.
const Net = require("net");
// Use JSON Canonicalize package
const canonicalize = require("canonicalize");
//Using semver to check the node version
const semver = require("semver");
//Using Level to store the trusted peers
const { Level } = require("level");

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
  constructor(socket, bootstrappingPeers) {
    this._nodeSocket = socket;
    this._bootstrappingPeers = bootstrappingPeers;
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
  // Create a database for initial bootstrapping peers
  const bootstrappingPeers = new Level("bootstrappingPeers", {
    valueEncoding: "json",
  });

  const socket = { port: "18018", host: "104.207.149.243" };

  // put initial peers from protocol into our database
  const initialPeers = [
    { port: 18018, host: "149.28.220.241" },
    { port: 18018, host: "149.28.204.235" },
    { port: 18018, host: "139.162.130.195" },
    socket,
  ];

  // load up database with our initial peers
  for (const [index, socket] of initialPeers.entries()) {
    await bootstrappingPeers.put(index, socket);
  }

  // create our node
  const node = new MyMaraNode(socket, bootstrappingPeers);

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
