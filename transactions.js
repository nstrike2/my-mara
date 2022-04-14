class Transaction {
  constructor(inputs, outputs) {
    this.inputs = inputs;
    this.outputs = outputs;
  }
}

export async function validation(knownObjects, transaction) {
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

async function doesTxExist(knownObjects, txid) {
  // check if this txid exists in the db
  if (await knownObjects.exists(txid)) {
    return true;
  }
  return false;
  // will return true if there is tx
  // if no tx then it would return false
}

async function checkIndex(knownObjects, txid, index) {
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

function validatePubKey(pubkey) {
  if (!pubkey.length == 64) return false;
  return true;
}

async function getValueForInput(knownObjects, txid, index) {
  // find the txid

  const transaction = await knownObjects.get(txid);
  // get output from tx;
  const outputs = transaction.outputs;

  // iterate through the the tx output to find the op that matches with the index
  // get it's value and return
  const value = outputs[index].value;

  return value;
}

/* Formats
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
  */

/* Tester
  var transaction = {
    objectid: "f71408bf847d7dd15824574a7cd4afdfaaa2866286910675cd3fc371507aa197",
    object: {
      type: "transaction",
      inputs: [
        {
          outpoint: {
            txid: "f71408bf847d7dd15824574a7cd4afdfaaa2866286910675cd3fc371507aa196",
            index: 0,
          },
          sig: "3869a9ea9e7ed926a7c8b30fb71f6ed151a132b03fd5dae764f015c98271000e7da322dbcfc97af7931c23c0fae060e102446ccff0f54ec00f9978f3a69a6f0f",
        },
      ],
      outputs: [
        {
          pubkey:
            "077a2683d776a71139fd4db4d00c16703ba0753fc8bdc4bd6fc56614e659cde3",
          value: 5100000000,
        },
      ],
    },
  }
  
  
  
  const knownObjects = [
    { 
      objectid: "f71408bf847d7dd15824574a7cd4afdfaaa2866286910675cd3fc371507aa196",
      object: 
      { 
        "type": "transaction", 
        "height": 128, 
        "outputs": [ 
          { "pubkey": "077a2683d776a71139fd4db4d00c16703ba0753fc8bdc4bd6fc56614e659cde3", 
            "value": 50000000000 
          }] 
      }
    },
    {
      object: {
        T: "00000002af000000000000000000000000000000000000000000000000000000",
        created: 1624219079,
        miner: "dionyziz",
        nonce:
          "0000000000000000000000000000000000000000000000000000002634878840",
        note: "The Economist 2021-06-20: Crypto-miners are probably to blame for the graphics-chip shortage",
        previd: null,
        txids: [],
        type: "block",
      },
    },
    {
      objectid: "f71408bf847d7dd15824574a7cd4afdfaaa2866286910675cd3fc371507aa197",
      object: {
        type: "transaction",
        inputs: [
          {
            outpoint: {
              txid: "f71408bf847d7dd15824574a7cd4afdfaaa2866286910675cd3fc371507aa196",
              index: 0,
            },
            sig: "3869a9ea9e7ed926a7c8b30fb71f6ed151a132b03fd5dae764f015c98271000e7da322dbcfc97af7931c23c0fae060e102446ccff0f54ec00f9978f3a69a6f0f",
          },
        ],
        outputs: [
          {
            pubkey:
              "077a2683d776a71139fd4db4d00c16703ba0753fc8bdc4bd6fc56614e659cde3",
            value: 5100000000,
          },
        ],
      },
    },
  ]
  validation(transaction);
  */

//   Validate here:

//                   const objectsindb = await this._knownObjects.iterator().all();
//                   const index = objectsindb.length;
//                   await this._knownObjects.put(index, object);

//                   // validate the transaction**

//                   const IHaveObject = {
//                     type: "ihaveobject",
//                     objectid: messageHash,
//                   };

//                   client.write(canonicalize(IHaveObject) + "\n");
//                 }
