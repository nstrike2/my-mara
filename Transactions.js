class Transaction {
  constructor(inputs, outputs) {
    this.inputs = inputs;
    this.outputs = outputs;
  }
}

function validation(transaction){
    var inputs = transaction.inputs;
    var outputs = transaction.outputs;
    var totalInputValue = 0;
    var totalOutputValue = 0;
    for (var ip = 0; ip < transaction.inputs.length; ip++) {
        var message = {
            type: "transaction",
            inputs: {
              outpoint: inputs[ip].outpoint,
              sig: null,
            },
            outputs: outputs,
          };
      
        var signature = inputs[ip].sig;
        var publicKey = "abc"; // look up the levels db and find the txid - it's outputs - get the pubkey.
        var txid = input[ip].outpoint.txid;
        var index = input[ip].outpoint.txid;

        if(!validateSignature(message, signature, publicKey)) return false;
        if(!doesTxExist(txid)) return false; 
        if(!checkIndex(txid, index)) return false; 

        totalInputValue = totalInputValue + getValueForInput(inputs[ip].outpoint.txid, inputs[ip].outpoint.index);
    }

    for (var op = 0; op < transaction.outputs.length; op++) {
       var value = outputs[op].value;
       var pubkey = outputs[op].pubkey;

       if(!validatePubKey(pubkey)) return false;
       if(value < 0) return false;

       totalOutputValue = totalOutputValue + value;

    }

    if(totalOutputValue > totalInputValue) return false;

    return true;
}
function validateSignature(message, signature, publicKey) {
  
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

function doesTxExist(txid) {

    return true;
    // will return true if there is tx
    // if no tx then it would return false
}

function checkIndex(txid, index){
    // fetch the txid - check the number of outputs it has 
    var noOfOutputs = 0;
    if(index < noOfOutputs){
        return true;
    }
    else{
        return false;
    }
}

function validatePubKey(pubkey){
    if(!pubkey.length == 64) return false;
    return true;
}

function getValueForInput(txid, index){
    // find the txid
    var transaction = ; // input from txid;
    // iterate through the the tx output to find the op that matches with the index
    // get it's value and return

    return value;
}


var input = {
  outpoint: {
    index: "abc",
    txid: "abc",
  },
  sig: "abc",
};

var output = {
  pubkey: "abc",
  value: "abc",
};
