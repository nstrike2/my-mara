var fetchPeersList = async (bootstrappingPeers) => {
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
};

var fetchObjectIDs = async (knownObjects) => {
  let knownObjectIDS = [];

  // iterate through most recent version of knownObjects database
  for await (const [index, object] of knownObjects.iterator()) {
    knownObjectIDS.push(index);
  }

  // return list of known objectid's
  return knownObjectIDS;
};

module.exports = {
  fetchObjectIDs: fetchObjectIDs,
  fetchPeersList: fetchPeersList,
};
