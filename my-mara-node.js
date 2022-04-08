// Include Nodejs' net module.
const Net = require("net");
// Use JSON Canonicalize package
const canonicalize = require("canonicalize");
//Using semver to check the node version
const semver = require("semver");
//Using Level to store the trusted peers
const { Level } = require("level");

class MyMaraNode {
  // socket = { port: port, host: host };
  // this socket passed in, which is the socket our node will run on, is added to our bootstrapping peers
  constructor(socket) {
    this._nodeSocket = socket;
  }

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

      const GetPeers = {
        type: "getpeers",
      };

      // The client can now send data to the server by writing to its socket.
      // event type: data

      // send hello message
      client.write(canonicalize(helloMsg) + "\n");
      console.log("Sent Hello Msg");

      // send getPeers message
      client.write(canonicalize(GetPeers) + "\n");
      console.log("Sent GetPeers Msg");
    });

    // The client can also receive data from the server by reading from its socket

    const peers = {
      type: "peers",
      peers: "dionyziz.com:18018",
    };

    client.on("data", (chunk) => {
      console.log(`Data received from node at ${host}: ${chunk.toString()}.`);
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

  // for testing purposes — we run this server on our localhost
  server(peersList) {
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
    server.on("connection", (socket) => {
      console.log("A new connection to the server has been established.");
      // Now that a TCP connection has been established, the server can send data to
      // the client by writing to its socket.
      const helloMsg = {
        type: "hello",
        version: "0.8.0",
        agent: "Marabu-Core Client 0.8",
      };

      const GetPeers = {
        type: "getpeers",
      };

      socket.write(canonicalize(helloMsg) + "\n");
      socket.write(canonicalize(GetPeers) + "\n");

      // let peersList = new Array(bootstrappingPeers.iterator().length);

      console.log(peersList);

      const peers = {
        type: "peers",
        peers: peersList,
      };

      // The server can also receive data from the client by reading from its socket.
      socket.on("data", (chunk) => {
        let array_chunk = chunk.toString().split("\n");
        console.log("Recieved data from client: " + chunk);

        for (let payload of array_chunk.slice(0, -1)) {
          // check if message is valid JSON object
          try {
            if (typeof JSON.parse(payload) === "object") {
              // check if type hello and if version of type 0.8.x
              // if not, close the connection immediately!!
              let message = JSON.parse(payload.toString());
              if (
                message.type === "hello" &&
                semver.satisfies(message.version, "0.8.x")
              ) {
                console.log("Successful hello message!!");
              } else if (message.type === "getpeers") {
                socket.write(canonicalize(peers) + "\n");
                console.log(
                  "Sent these peers to client: " + JSON.stringify(peers)
                );
              } else {
                const error = {
                  type: "error",
                  error: "Unsupported message type received",
                };
                array_chunk = [];
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
          array_chunk = [];
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
  // "104.207.149.243"

  // put initial peers from protocol into our database
  const initialPeers = [
    { port: 18018, host: "149.28.220.241" },
    { port: 18018, host: "149.28.204.235" },
    { port: 18018, host: "139.162.130.195" },
    socket,
  ];

  let peersList = new Array(bootstrappingPeers.iterator().length);

  for (const [index, socket] of initialPeers.entries()) {
    await bootstrappingPeers.put(index, socket);
    if (socket !== null) {
      peersList.push((socket["host"] + ":" + socket["port"]).toString());
      // console.log(
      //   "LALA: " + (socket["host"] + ":" + socket["port"]).toString()
      // );
    }
  }

  // create our node
  // const node = new MyMaraNode({ port: "18018", host: "localhost" });
  const node = new MyMaraNode(socket);

  // run server from our node
  node.server(peersList);

  // connect to each of our node's trusted sockets from database
  for await (const [index, socket] of bootstrappingPeers.iterator()) {
    node.client(socket.port, socket.host);
  }
};

// driver code
loadNode();
