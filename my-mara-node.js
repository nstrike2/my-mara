// Include Nodejs' net module.
const Net = require("net");

// Use JSON Canonicalize package
const canonicalize = require("canonicalize");

//Using semver to check the node version

const semver = require("semver");

const { Level } = require("level");

const createBootstrappingPeers = async () => {
  // Create a database
  const bootstrappingPeers = new Level("bootstrappingPeers", {
    valueEncoding: "json",
  });

  // Add an entry with key 'a' and value 1
  await bootstrappingPeers.put(0, { port: 18018, host: "149.28.220.241" });
  await bootstrappingPeers.put(1, { port: 18018, host: "149.28.204.235" });
  await bootstrappingPeers.put(2, { port: 18018, host: "139.162.130.195" });
};

class MyMaraNode {
  // socket = { port: port, host: host };
  // this socket passed in, which is the socket our node will run on, is added to our trusted sockets
  constructor(socket) {
    // this.trustedSockets = [
    //   { port: 18018, host: "149.28.220.241" },
    //   { port: 18018, host: "149.28.204.235" },
    //   { port: 18018, host: "139.162.130.195" },
    // ];
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

    // The client can also receive data from the server by reading from its socket.
    client.on("data", (chunk) => {
      console.log(`Data received from the server: ${chunk.toString()}.`);
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
    server.on("connection", (socket) => {
      console.log("A new connection to the server has been established.");
      // Now that a TCP connection has been established, the server can send data to
      // the client by writing to its socket.
      const helloMsg = {
        type: "hello",
        version: "0.8.0",
        agent: "Marabu-Core Client 0.8",
      };
      socket.write(canonicalize(helloMsg) + "\n");
      const peers = {
        type: "peers",
        peers: "dionyziz.com:18018",
      };
      // The server can also receive data from the client by reading from its socket.
      socket.on("data", (chunk) => {
        let array_chunk = chunk.toString().split("\n");
        console.log("Recieved data from client: " + chunk);

        for (let payload of array_chunk.slice(0, -1)) {
          // check if message is valid JSON object
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
              socket.end();
            }
          } else {
            // throw error
            const error = {
              type: "error",
              error: "Unsupported message type received",
            };
            throw error;
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
const loadNode = () => {
  // create node
  const node = new MyMaraNode({ port: "18018", host: "localhost" });

  // run server
  node.server();

  // create boostrapping peers database
  createBootstrappingPeers();

  // connect to each of our node's trusted sockets
  //for (let socket of node.trustedSockets) {
  // run client and connect to trusted socket
  //  node.client(socket.port, socket.host);
  //}
  node.client("18018", "localhost");
};

// driver code
loadNode();
