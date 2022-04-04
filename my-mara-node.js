// Include Nodejs' net module.
const Net = require('net');

// Use JSON Canonicalize package
const canonicalize = require('canonicalize');

class MyMaraNode {
    // socket = { port: port, host: host }
    constructor(socket) {
        this._port = socket.port;
        this._host = socket.host;
    }

    #isJsonObject(data) {
        console.log(data);
        try {
            JSON.parse(data);
        } catch (e) {
            return false;
        }
        return true;
    }

    client() {
        // The port number and hostname of the server.
        const port = this._port;
        const host = this._host;

        // Create a new TCP client.
        const client = new Net.Socket();
        // Send a connection request to the server.
        client.connect({ port: port, host: host }, () => {
            // If there is no error, the server has accepted the request and created a new 
            // socket dedicated to us.
            console.log('TCP connection established with the server.');

            const helloMsg = { "type": "hello", "version": "0.8.0", "agent": "Marabu-Core Client 0.8" };

            // The client can now send data to the server by writing to its socket.
            // event type: data
            client.write(canonicalize(helloMsg));
        });

        // The client can also receive data from the server by reading from its socket.
        client.on('data', (chunk) => {
            console.log(`Data received from the server: ${chunk.toString()}.`);

            // Request an end to the connection after the data has been received.
            // client.end();
        });

        client.on('end', () => {
            console.log('Requested an end to the TCP connection');
        });
    }

    server() {
        // The port on which the server is listening.
        const port = this._port;

        // Use net.createServer() in your code. This is just for illustration purpose.
        // Create a new TCP server.
        const server = new Net.Server();

        // The server listens to a socket for a client to make a connection request.
        // Think of a socket as an end point.
        server.listen(port, () => {
            console.log(`Server listening for connection requests on socket localhost:${port}.`);
        });

        // When a client requests a connection with the server, the server creates a new
        // socket dedicated to that client.
        server.on('connection', (socket) => {
            
            console.log('A new connection has been established.');

            // Now that a TCP connection has been established, the server can send data to
            // the client by writing to its socket.
            socket.write('Hello, client.');

            // The server can also receive data from the client by reading from its socket.
            socket.on('data', (chunk) => {

                // check if message is valid JSON object
                if (typeof JSON.parse(chunk.toString()) === "object") {
                    // check if type hello and if version of type 0.8.x
                    // if not, close the connection immediately!!
                    let message = JSON.parse(chunk.toString());
                    message.type !== "hello" || message.version.slice(0, 3) !== "0.8" ? socket.end() : console.log("Successful hello message!!");
                } else { // throw error
                    const error = { "type": "error", "error": "Unsupported message type received" };
                    throw error;
                }

                // console.log(`Data received from client: ${chunk.toString()}.`);
            });

            // When the client requests to end the TCP connection with the server, the server
            // ends the connection.
            socket.on('end', () => {
                console.log('Closing connection with the client');
            });

            // Don't forget to catch error, for your own sake.
            socket.on('error', (err) => {
                console.log(`Error: ${ err }`);
            });
        });
    }
}

// driver code

// create node
const node = new MyMaraNode({ port: "18018", host: "localhost" });

// run server
node.server();

// run client
node.client();