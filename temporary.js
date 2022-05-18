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
    //check if block is complete
    objectids = await fetchObjectIDs(knownObjects);
    for await (const [hash, block] of blocksandtxids.iterator()) {
      console.log("Testing");
      console.log(`${block.txids}`);
      console.log(`${hash}`);
      if (
        block.txids !== "" &&
        block.txids !== null &&
        typeof block.txids !== "undefined"
      ) {
        if (alltxnsofblockcorrect(block.txids, objectids)) {
          await knownObjects.put(hash, block);
          if (coinbasecheck(block, knownObjects)) {
            if (
              checkUTXO(
                message.object,
                messageHash,
                block,
                hash,
                UTXOset,
                knownObjects
              )
            ) {
              const IHaveObject = {
                type: "ihaveobject",
                objectid: hash,
              };
              client.write(canonicalize(IHaveObject) + "\n");
              console.log("UTXO works");
            } else {
              const error = {
                type: "error",
                error: "Invalid UTXO",
              };
              await knownObjects.del(hash);
              client.write(canonicalize(error) + "\n");
            }
          } else {
            const error = {
              type: "error",
              error: "Invalid coinbase",
            };
            await knownObjects.del(hash);
            client.write(canonicalize(error) + "\n");
          }

          //check for coinbase transaction
        }
      }
    }
  } else {
    const error = {
      type: "error",
      error: "Failed to verify transaction",
    };
    client.write(canonicalize(error) + "\n");
  }
}
